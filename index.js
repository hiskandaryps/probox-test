const axios = require('axios');
const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const cron = require('node-cron');
const bodyParser = require('body-parser');
const { format } = require("date-fns");

const app = express();
const port = 3000; // Change this to your desired port

const iotCentralAppUrl = 'https://cpsprobox.azureiotcentral.com';
const deviceId = 'cpsprobox';
const sasToken = 'sr=5ec548d8-8e1d-49db-8288-f71dde6250b8&sig=KiLBpzQSHNMZFZfgBHN5etta334YNfi7DJ7hLOiZoRY%3D&skn=cpsprobox&se=1723963307100';

const supabaseUrl = 'https://qjmkhtotmxgmlgbvzhlu.supabase.co'; // Replace with your Supabase URL
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFqbWtodG90bXhnbWxnYnZ6aGx1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE2OTI1OTAyMjgsImV4cCI6MjAwODE2NjIyOH0.VYLIu61pGcd2pfzcnLmwxIPLfRqYU6YZ5pLOhfa0SRs'; // Replace with your Supabase API Key
const supabase = createClient(supabaseUrl, supabaseKey);

let telemetryData = {
  UID: null,
  Status: null,
  Lock: null,
};

const insertToDatabase = async (UID, status, first, timestamp) => {
  try {
    const { data, error } = await supabase
      .from('history')
      .upsert([
        {
          uid: UID,
          status: status,
          first: first,
          timestamp: timestamp,
        },
      ]);

    if (error) {
      console.error('Error inserting data:', error);
    } else {
      console.log('Data inserted successfully:', data);
    }
  } catch (error) {
    console.error('An error occurred:', error);
  }
};

const fetchTelemetryData = async () => {
  try {
    const telemetry1Response = await axios.get(
      `${iotCentralAppUrl}/api/preview/devices/${deviceId}/telemetry/UID`,
      {
        headers: {
          Authorization: `SharedAccessSignature ${sasToken}`,
        },
      }
    );

    const telemetry2Response = await axios.get(
      `${iotCentralAppUrl}/api/preview/devices/${deviceId}/telemetry/Status`,
      {
        headers: {
          Authorization: `SharedAccessSignature ${sasToken}`,
        },
      }
    );

    const telemetry3Response = await axios.get(
      `${iotCentralAppUrl}/api/preview/devices/${deviceId}/telemetry/Lock`,
      {
        headers: {
          Authorization: `SharedAccessSignature ${sasToken}`,
        },
      }
    );

    const UID = telemetry1Response.data.value || null; // Check and set to null if value is empty
    const status = telemetry2Response.data.value;
    const first = telemetry3Response.data.value;
    const timestamp = format(new Date(), "yyyy-MM-dd HH:mm:ss");

    telemetryData = {
      UID: UID,
      Status: status,
      Lock: first,
    };

    if (UID !== null) {
      await insertToDatabase(UID, status, first, timestamp);
    }

    console.log('Telemetry data fetched:', telemetryData);
  } catch (error) {
    console.error('Error fetching telemetry data:', error);
  }
};

// Schedule the task to run every 1 second
cron.schedule('* * * * * *', async () => {
  console.log('Fetching telemetry data...');
  await fetchTelemetryData();
});

app.get('/api/telemetry', async (req, res) => {
  try {
    const { data: latestData, error: latestError } = await supabase
      .from('history')
      .select('uid', 'timestamp')
      .order('id', { ascending: false })
      .limit(1);

    if (latestError) {
      console.error('Error fetching latest history data:', latestError);
      res.status(500).json({ message: 'Error fetching latest history data' });
    } else {
      if (!latestData || latestData.length === 0) {
        console.log('No history data found.');
        res.status(404).json({ message: 'No history data found' });
      } else {
        console.log('Latest history data fetched successfully');
        const latest_uid = latestData[0].uid;
        const latest_time = latestData[0].timestamp;

        res.json({
          message: "Data fetched",
          data: {
            UID: latest_uid,
            Status: telemetryData.Status,
            Lock: telemetryData.Lock,
            Timestamp: latest_time,
          },
        });
      }
    }
  } catch (error) {
    console.error('An error occurred:', error);
    res.status(500).json({ message: 'An error occurred' });
  }
});

app.get('/api/history', async (req, res) => {
  try {
    const { data: historyData, error: historyError } = await supabase
        .from('history')
        .select('*')
        .order('id', { ascending: false })
        .range(1, 4);

    if (historyError) {
      console.error('Error fetching history data:', historyError);
      res.status(500).json({ message: 'Error fetching history data' });
    } else {
      console.log('History data fetched successfully');
      res.status(200).json({
        message: 'History data fetched successfully',
        data: historyData,
      });
    }
  } catch (error) {
    console.error('An error occurred:', error);
    res.status(500).json({ message: 'An error occurred' });
  }
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
