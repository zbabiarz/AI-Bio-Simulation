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

    const headers = {
      Authorization: `Bearer ${userConnection.access_token}`,
    };

    const metricsMap = new Map<string, Record<string, unknown>>();
    const today = new Date();
    const dates: string[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      dates.push(d.toISOString().split("T")[0]);
    }

    for (const date of dates) {
      const [sleepResponse, activityResponse, hrvResponse] = await Promise.all([
        fetch(`https://api.fitbit.com/1.2/user/-/sleep/date/${date}.json`, { headers }),
        fetch(`https://api.fitbit.com/1/user/-/activities/date/${date}.json`, { headers }),
        fetch(`https://api.fitbit.com/1/user/-/hrv/date/${date}.json`, { headers }),
      ]);

      if (!metricsMap.has(date)) {
        metricsMap.set(date, { date, user_id, source: "fitbit" });
      }
      const metric = metricsMap.get(date)!;

      if (sleepResponse.ok) {
        const sleepData = await sleepResponse.json();
        const mainSleep = sleepData.sleep?.find((s: { isMainSleep: boolean }) => s.isMainSleep);
        if (mainSleep) {
          metric.sleep_duration_minutes = mainSleep.minutesAsleep || mainSleep.duration ? Math.round(mainSleep.duration / 60000) : 0;
          metric.sleep_efficiency = mainSleep.efficiency;
          if (mainSleep.levels?.summary) {
            metric.deep_sleep_minutes = mainSleep.levels.summary.deep?.minutes || 0;
            metric.rem_sleep_minutes = mainSleep.levels.summary.rem?.minutes || 0;
            metric.light_sleep_minutes = mainSleep.levels.summary.light?.minutes || 0;
          }
        }
        if (sleepData.summary) {
          metric.sleep_duration_minutes = sleepData.summary.totalMinutesAsleep || metric.sleep_duration_minutes;
        }
      }

      if (activityResponse.ok) {
        const activityData = await activityResponse.json();
        if (activityData.summary) {
          metric.steps = activityData.summary.steps;
          metric.active_calories = activityData.summary.activityCalories || activityData.summary.caloriesOut;
          metric.total_calories = activityData.summary.caloriesOut;
          metric.activity_minutes = (activityData.summary.fairlyActiveMinutes || 0) + (activityData.summary.veryActiveMinutes || 0);
          metric.resting_heart_rate = activityData.summary.restingHeartRate;
        }
      }

      if (hrvResponse.ok) {
        const hrvData = await hrvResponse.json();
        if (hrvData.hrv && hrvData.hrv.length > 0) {
          const hrvEntry = hrvData.hrv[0];
          if (hrvEntry.value?.dailyRmssd) {
            metric.hrv = Math.round(hrvEntry.value.dailyRmssd);
          } else if (hrvEntry.value?.rmssd) {
            metric.hrv = Math.round(hrvEntry.value.rmssd);
          }
        }
      }
    }

    const metrics = Array.from(metricsMap.values()).filter((m) => Object.keys(m).length > 3);

    if (metrics.length > 0) {
      const { error: metricsError } = await supabase
        .from("health_metrics")
        .upsert(metrics, { onConflict: "user_id,date,source" });

      if (metricsError) {
        console.error("Error inserting metrics:", metricsError);
        throw new Error("Failed to save metrics");
      }

      const latestMetric = metrics[0];
      const normalized = {
        hrv: latestMetric.hrv,
        resting_hr: latestMetric.resting_heart_rate,
        sleep_hours: latestMetric.sleep_duration_minutes
          ? Math.round((Number(latestMetric.sleep_duration_minutes) / 60) * 10) / 10
          : undefined,
        steps: latestMetric.steps,
      };

      await supabase.from("wearable_data").insert({
        user_id,
        source: "fitbit",
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

    const startDate = dates[dates.length - 1];
    const endDate = dates[0];

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
    console.error("Fitbit sync error:", err);
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
