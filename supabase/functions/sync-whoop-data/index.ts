import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface SyncRequest {
  user_id: string;
  connection_id: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { user_id, connection_id }: SyncRequest = await req.json();

    const { data: connection, error: connError } = await supabase
      .from("device_connections")
      .select("*")
      .eq("id", connection_id)
      .eq("user_id", user_id)
      .single();

    if (connError || !connection) {
      throw new Error("Connection not found");
    }

    const { data: userConnection } = await supabase
      .from("user_connections")
      .select("*")
      .eq("user_id", user_id)
      .eq("provider", connection.provider)
      .maybeSingle();

    if (!userConnection || !userConnection.access_token) {
      throw new Error("No access token found");
    }

    const today = new Date();
    const startDate = new Date(today.setDate(today.getDate() - 7)).toISOString().split("T")[0];
    const endDate = new Date().toISOString().split("T")[0];

    const headers = {
      Authorization: `Bearer ${userConnection.access_token}`,
    };

    const [cycleResponse, recoveryResponse, sleepResponse, workoutResponse] = await Promise.all([
      fetch(
        `https://api.whoop.com/v1/cycle?start=${startDate}&end=${endDate}`,
        { headers }
      ),
      fetch(
        `https://api.whoop.com/v1/recovery?start=${startDate}&end=${endDate}`,
        { headers }
      ),
      fetch(
        `https://api.whoop.com/v1/sleep?start=${startDate}&end=${endDate}`,
        { headers }
      ),
      fetch(
        `https://api.whoop.com/v1/workout?start=${startDate}&end=${endDate}`,
        { headers }
      ),
    ]);

    if (!cycleResponse.ok || !recoveryResponse.ok || !sleepResponse.ok || !workoutResponse.ok) {
      throw new Error("Failed to fetch data from WHOOP API");
    }

    const cycleData = await cycleResponse.json();
    const recoveryData = await recoveryResponse.json();
    const sleepData = await sleepResponse.json();
    const workoutData = await workoutResponse.json();

    const metricsMap = new Map<string, any>();

    recoveryData.records?.forEach((recovery: any) => {
      const date = recovery.created_at?.split("T")[0];
      if (!date) return;
      
      if (!metricsMap.has(date)) {
        metricsMap.set(date, { date, user_id, source: "whoop" });
      }
      const metric = metricsMap.get(date);
      metric.recovery_score = recovery.score?.recovery_score;
      metric.hrv = recovery.score?.hrv_rmssd_milli;
      metric.resting_heart_rate = recovery.score?.resting_heart_rate;
    });

    sleepData.records?.forEach((sleep: any) => {
      const date = sleep.created_at?.split("T")[0];
      if (!date) return;

      if (!metricsMap.has(date)) {
        metricsMap.set(date, { date, user_id, source: "whoop" });
      }
      const metric = metricsMap.get(date);
      
      const totalSleepSeconds = sleep.score?.stage_summary?.total_in_bed_time_milli;
      if (totalSleepSeconds) {
        metric.sleep_duration_minutes = Math.round(totalSleepSeconds / 1000 / 60);
      }
      
      const deepSleepSeconds = sleep.score?.stage_summary?.total_slow_wave_sleep_time_milli;
      if (deepSleepSeconds) {
        metric.deep_sleep_minutes = Math.round(deepSleepSeconds / 1000 / 60);
      }
      
      const remSleepSeconds = sleep.score?.stage_summary?.total_rem_sleep_time_milli;
      if (remSleepSeconds) {
        metric.rem_sleep_minutes = Math.round(remSleepSeconds / 1000 / 60);
      }
      
      const lightSleepSeconds = sleep.score?.stage_summary?.total_light_sleep_time_milli;
      if (lightSleepSeconds) {
        metric.light_sleep_minutes = Math.round(lightSleepSeconds / 1000 / 60);
      }
      
      metric.sleep_efficiency = sleep.score?.sleep_efficiency_percentage;
    });

    cycleData.records?.forEach((cycle: any) => {
      const date = cycle.created_at?.split("T")[0];
      if (!date) return;

      if (!metricsMap.has(date)) {
        metricsMap.set(date, { date, user_id, source: "whoop" });
      }
      const metric = metricsMap.get(date);
      
      metric.active_calories = cycle.score?.kilojoule;
    });

    workoutData.records?.forEach((workout: any) => {
      const date = workout.created_at?.split("T")[0];
      if (!date) return;

      if (!metricsMap.has(date)) {
        metricsMap.set(date, { date, user_id, source: "whoop" });
      }
      const metric = metricsMap.get(date);
      
      if (workout.score?.duration_milli) {
        metric.activity_minutes = (metric.activity_minutes || 0) + Math.round(workout.score.duration_milli / 1000 / 60);
      }
    });

    const metrics = Array.from(metricsMap.values());

    if (metrics.length > 0) {
      const { error: metricsError } = await supabase
        .from("health_metrics")
        .upsert(metrics, { onConflict: "user_id,date,source" });

      if (metricsError) {
        console.error("Error inserting metrics:", metricsError);
        throw new Error("Failed to save metrics");
      }

      const latestMetric = metrics[metrics.length - 1];
      const normalized = {
        hrv: latestMetric.hrv,
        resting_hr: latestMetric.resting_heart_rate,
        sleep_hours: latestMetric.sleep_duration_minutes
          ? Math.round((latestMetric.sleep_duration_minutes / 60) * 10) / 10
          : undefined,
        recovery_score: latestMetric.recovery_score,
      };

      await supabase.from("wearable_data").insert({
        user_id,
        source: "whoop",
        normalized,
      });
    }

    await supabase
      .from("device_connections")
      .update({
        last_sync_at: new Date().toISOString(),
        sync_status: "active",
        sync_error: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", connection_id);

    await supabase.from("activity_logs").insert({
      user_id,
      action: "sync_device",
      details: { provider: connection.provider, records: metrics.length },
    });

    return new Response(
      JSON.stringify({
        success: true,
        records: metrics.length,
        date_range: { start: startDate, end: endDate },
      }),
      {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  } catch (err) {
    console.error("WHOOP sync error:", err);
    return new Response(
      JSON.stringify({
        error: err instanceof Error ? err.message : "An unexpected error occurred",
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  }
});