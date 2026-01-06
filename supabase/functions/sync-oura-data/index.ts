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

    const [sleepResponse, activityResponse, readinessResponse] = await Promise.all([
      fetch(
        `https://api.ouraring.com/v2/usercollection/daily_sleep?start_date=${startDate}&end_date=${endDate}`,
        { headers }
      ),
      fetch(
        `https://api.ouraring.com/v2/usercollection/daily_activity?start_date=${startDate}&end_date=${endDate}`,
        { headers }
      ),
      fetch(
        `https://api.ouraring.com/v2/usercollection/daily_readiness?start_date=${startDate}&end_date=${endDate}`,
        { headers }
      ),
    ]);

    if (!sleepResponse.ok || !activityResponse.ok || !readinessResponse.ok) {
      throw new Error("Failed to fetch data from Oura API");
    }

    const sleepData = await sleepResponse.json();
    const activityData = await activityResponse.json();
    const readinessData = await readinessResponse.json();

    const metricsMap = new Map<string, any>();

    sleepData.data?.forEach((sleep: any) => {
      const date = sleep.day;
      if (!metricsMap.has(date)) {
        metricsMap.set(date, { date, user_id, source: "oura" });
      }
      const metric = metricsMap.get(date);
      metric.sleep_duration_minutes = sleep.contributors?.total_sleep_time || 0;
      metric.deep_sleep_minutes = sleep.contributors?.deep_sleep || 0;
      metric.rem_sleep_minutes = sleep.contributors?.rem_sleep || 0;
      metric.light_sleep_minutes = sleep.contributors?.light_sleep || 0;
      metric.sleep_efficiency = sleep.contributors?.sleep_efficiency;
      metric.resting_heart_rate = sleep.contributors?.resting_heart_rate;
      metric.hrv = sleep.contributors?.hrv_balance;
    });

    activityData.data?.forEach((activity: any) => {
      const date = activity.day;
      if (!metricsMap.has(date)) {
        metricsMap.set(date, { date, user_id, source: "oura" });
      }
      const metric = metricsMap.get(date);
      metric.steps = activity.steps;
      metric.active_calories = activity.active_calories;
      metric.total_calories = activity.total_calories;
      metric.activity_minutes = activity.high_activity_time
        ? Math.round(activity.high_activity_time / 60)
        : 0;
    });

    readinessData.data?.forEach((readiness: any) => {
      const date = readiness.day;
      if (!metricsMap.has(date)) {
        metricsMap.set(date, { date, user_id, source: "oura" });
      }
      const metric = metricsMap.get(date);
      metric.recovery_score = readiness.score;
      if (readiness.contributors?.hrv_balance) {
        metric.hrv = readiness.contributors.hrv_balance;
      }
      if (readiness.contributors?.resting_heart_rate) {
        metric.resting_heart_rate = readiness.contributors.resting_heart_rate;
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
        steps: latestMetric.steps,
        recovery_score: latestMetric.recovery_score,
      };

      await supabase.from("wearable_data").insert({
        user_id,
        source: "oura",
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
    console.error("Oura sync error:", err);
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
