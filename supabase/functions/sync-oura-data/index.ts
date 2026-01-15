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

    const [sleepResponse, activityResponse, readinessResponse, heartRateResponse] = await Promise.all([
      fetch(
        `https://api.ouraring.com/v2/usercollection/sleep?start_date=${startDate}&end_date=${endDate}`,
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
      fetch(
        `https://api.ouraring.com/v2/usercollection/heartrate?start_date=${startDate}&end_date=${endDate}`,
        { headers }
      ),
    ]);

    if (!sleepResponse.ok) {
      const errorText = await sleepResponse.text();
      console.error("Sleep API error:", sleepResponse.status, errorText);
      throw new Error(`Failed to fetch sleep data: ${sleepResponse.status}`);
    }

    if (!activityResponse.ok) {
      const errorText = await activityResponse.text();
      console.error("Activity API error:", activityResponse.status, errorText);
      throw new Error(`Failed to fetch activity data: ${activityResponse.status}`);
    }

    if (!readinessResponse.ok) {
      const errorText = await readinessResponse.text();
      console.error("Readiness API error:", readinessResponse.status, errorText);
      throw new Error(`Failed to fetch readiness data: ${readinessResponse.status}`);
    }

    const sleepData = await sleepResponse.json();
    const activityData = await activityResponse.json();
    const readinessData = await readinessResponse.json();

    let heartRateData: { data?: any[] } = { data: [] };
    if (heartRateResponse.ok) {
      heartRateData = await heartRateResponse.json();
    }

    const metricsMap = new Map<string, any>();

    sleepData.data?.forEach((sleep: any) => {
      const date = sleep.day;
      if (!metricsMap.has(date)) {
        metricsMap.set(date, { date, user_id, source: "oura" });
      }
      const metric = metricsMap.get(date);

      if (sleep.total_sleep_duration !== undefined) {
        metric.sleep_duration_minutes = Math.round(sleep.total_sleep_duration / 60);
      }
      if (sleep.deep_sleep_duration !== undefined) {
        metric.deep_sleep_minutes = Math.round(sleep.deep_sleep_duration / 60);
      }
      if (sleep.rem_sleep_duration !== undefined) {
        metric.rem_sleep_minutes = Math.round(sleep.rem_sleep_duration / 60);
      }
      if (sleep.light_sleep_duration !== undefined) {
        metric.light_sleep_minutes = Math.round(sleep.light_sleep_duration / 60);
      }
      if (sleep.efficiency !== undefined) {
        metric.sleep_efficiency = sleep.efficiency;
      }
      if (sleep.average_hrv !== undefined) {
        metric.hrv = Math.round(sleep.average_hrv);
      }
      if (sleep.lowest_heart_rate !== undefined) {
        metric.resting_heart_rate = sleep.lowest_heart_rate;
      }
    });

    activityData.data?.forEach((activity: any) => {
      const date = activity.day;
      if (!metricsMap.has(date)) {
        metricsMap.set(date, { date, user_id, source: "oura" });
      }
      const metric = metricsMap.get(date);
      if (activity.steps !== undefined) {
        metric.steps = activity.steps;
      }
      if (activity.active_calories !== undefined) {
        metric.active_calories = activity.active_calories;
      }
      if (activity.total_calories !== undefined) {
        metric.total_calories = activity.total_calories;
      }
      if (activity.high_activity_time !== undefined) {
        metric.activity_minutes = Math.round(activity.high_activity_time / 60);
      } else if (activity.medium_activity_time !== undefined) {
        metric.activity_minutes = Math.round(activity.medium_activity_time / 60);
      }
    });

    readinessData.data?.forEach((readiness: any) => {
      const date = readiness.day;
      if (!metricsMap.has(date)) {
        metricsMap.set(date, { date, user_id, source: "oura" });
      }
      const metric = metricsMap.get(date);
      if (readiness.score !== undefined) {
        metric.recovery_score = readiness.score;
      }
    });

    if (heartRateData.data && heartRateData.data.length > 0) {
      const hrByDate = new Map<string, number[]>();
      heartRateData.data.forEach((hr: any) => {
        if (hr.timestamp && hr.bpm) {
          const date = hr.timestamp.split("T")[0];
          if (!hrByDate.has(date)) {
            hrByDate.set(date, []);
          }
          hrByDate.get(date)!.push(hr.bpm);
        }
      });

      hrByDate.forEach((bpmValues, date) => {
        if (metricsMap.has(date)) {
          const metric = metricsMap.get(date);
          if (!metric.resting_heart_rate) {
            const minHr = Math.min(...bpmValues);
            metric.resting_heart_rate = minHr;
          }
        }
      });
    }

    const metrics = Array.from(metricsMap.values()).filter(m => {
      return m.sleep_duration_minutes !== undefined ||
             m.steps !== undefined ||
             m.recovery_score !== undefined ||
             m.hrv !== undefined;
    });

    if (metrics.length > 0) {
      const { error: metricsError } = await supabase
        .from("health_metrics")
        .upsert(metrics, { onConflict: "user_id,date,source" });

      if (metricsError) {
        console.error("Error inserting metrics:", metricsError);
        throw new Error("Failed to save metrics");
      }

      const sortedMetrics = [...metrics].sort((a, b) =>
        new Date(b.date).getTime() - new Date(a.date).getTime()
      );
      const latestMetric = sortedMetrics[0];

      const normalized = {
        hrv: latestMetric.hrv,
        resting_hr: latestMetric.resting_heart_rate,
        sleep_hours: latestMetric.sleep_duration_minutes
          ? Math.round((latestMetric.sleep_duration_minutes / 60) * 10) / 10
          : undefined,
        deep_sleep_hours: latestMetric.deep_sleep_minutes
          ? Math.round((latestMetric.deep_sleep_minutes / 60) * 10) / 10
          : undefined,
        rem_sleep_hours: latestMetric.rem_sleep_minutes
          ? Math.round((latestMetric.rem_sleep_minutes / 60) * 10) / 10
          : undefined,
        sleep_efficiency: latestMetric.sleep_efficiency,
        steps: latestMetric.steps,
        recovery_score: latestMetric.recovery_score,
        active_calories: latestMetric.active_calories,
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
