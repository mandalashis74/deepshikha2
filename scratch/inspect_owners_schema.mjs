const supabaseUrl = 'https://xkpqkbberckxblkhseim.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhrcHFrYmJlcmNreGJsa2hzZWltIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk2ODQ4NzMsImV4cCI6MjA5NTI2MDg3M30.y6cgL70Aw0bPSXlU2NgdMl3k0yBOxwHFBg9L57E79AE';

async function inspectOwnersRow() {
    const res = await fetch(`${supabaseUrl}/rest/v1/owners?select=*&limit=1`, {
        headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`
        }
    });
    const rows = await res.json();
    if (rows.length > 0) {
        const row = rows[0];
        console.log("Sample Owner Row:");
        for (const [key, value] of Object.entries(row)) {
            console.log(`Column: ${key} | Type: ${typeof value} | Value:`, value);
        }
    } else {
        console.log("No owners found.");
    }
}

inspectOwnersRow();
