const supabaseUrl = 'https://xkpqkbberckxblkhseim.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhrcHFrYmJlcmNreGJsa2hzZWltIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk2ODQ4NzMsImV4cCI6MjA5NTI2MDg3M30.y6cgL70Aw0bPSXlU2NgdMl3k0yBOxwHFBg9L57E79AE';

async function inspectMeetings() {
    const resM = await fetch(`${supabaseUrl}/rest/v1/meetings?select=*`, {
        headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`
        }
    });
    const meetings = await resM.json();
    console.log("Meetings count:", meetings.length);
    meetings.forEach(m => {
        console.log(`ID: ${m.id} | Title: ${m.title} | Type: ${m.type} | Status: ${m.status} | Minutes URL: ${m.minutes_url}`);
    });

    const resR = await fetch(`${supabaseUrl}/rest/v1/resolutions?select=*`, {
        headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`
        }
    });
    const resolutions = await resR.json();
    console.log("\nResolutions count:", resolutions.length);
    resolutions.forEach(r => {
        console.log(`ID: ${r.id} | Meeting ID: ${r.meeting_id} | Title: ${r.title} | Number: ${r.resolution_number}`);
    });
}

inspectMeetings();
