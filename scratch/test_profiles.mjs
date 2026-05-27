const supabaseUrl = 'https://xkpqkbberckxblkhseim.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhrcHFrYmJlcmNreGJsa2hzZWltIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk2ODQ4NzMsImV4cCI6MjA5NTI2MDg3M30.y6cgL70Aw0bPSXlU2NgdMl3k0yBOxwHFBg9L57E79AE';

async function testProfiles() {
    const response = await fetch(`${supabaseUrl}/rest/v1/profiles?select=id,email,role`, {
        headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`
        }
    });
    
    if (!response.ok) {
        console.error("Error status:", response.status);
    }
    const data = await response.json();
    console.log("Profiles response:", data);
}

testProfiles();
