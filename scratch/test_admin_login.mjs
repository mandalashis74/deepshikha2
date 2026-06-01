const supabaseUrl = 'https://xkpqkbberckxblkhseim.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhrcHFrYmJlcmNreGJsa2hzZWltIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk2ODQ4NzMsImV4cCI6MjA5NTI2MDg3M30.y6cgL70Aw0bPSXlU2NgdMl3k0yBOxwHFBg9L57E79AE';

async function testLogin(email, password) {
    const response = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
        method: 'POST',
        headers: {
            'apikey': supabaseKey,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email, password })
    });
    const data = await response.json();
    if (response.ok) {
        console.log(`Success logging in as ${email}:`, data.access_token ? "got token" : "no token");
        return data.access_token;
    } else {
        console.log(`Failed to log in as ${email}:`, data);
        return null;
    }
}

async function run() {
    await testLogin("admin@deepsikha.in", "admin123");
    await testLogin("admin1@deepsikha.in", "admin123");
    await testLogin("admin@deepsikha.in", "admin");
    await testLogin("admin1@deepsikha.in", "admin1");
}

run();
