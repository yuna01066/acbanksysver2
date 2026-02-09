import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const NOTION_API_URL = 'https://api.notion.com/v1';
const DATABASE_ID = '302e58d26996819f868acd67b99c47a8';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const NOTION_API_KEY = Deno.env.get('NOTION_API_KEY');
    if (!NOTION_API_KEY) {
      throw new Error('NOTION_API_KEY is not configured');
    }

    console.log('Fetching Notion database:', DATABASE_ID);

    // Query the Notion database
    const response = await fetch(`${NOTION_API_URL}/databases/${DATABASE_ID}/query`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${NOTION_API_KEY}`,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        page_size: 100,
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error('Notion API error:', response.status, errorBody);
      throw new Error(`Notion API call failed [${response.status}]: ${errorBody}`);
    }

    const data = await response.json();
    console.log(`Fetched ${data.results?.length || 0} projects from Notion`);

    // Extract relevant fields from each page
    const projects = data.results.map((page: any) => {
      const properties = page.properties;
      
      // Try to find title, date, and person properties dynamically
      let title = '';
      let createdDate = page.created_time;
      let assignee = '';

      for (const [key, value] of Object.entries(properties)) {
        const prop = value as any;
        
        // Get title
        if (prop.type === 'title' && prop.title?.length > 0) {
          title = prop.title.map((t: any) => t.plain_text).join('');
        }
        
        // Get date property (use first date property found, prefer ones named with common date names)
        if (prop.type === 'date' && prop.date?.start) {
          createdDate = prop.date.start;
        }
        
        // Get created_time property
        if (prop.type === 'created_time') {
          createdDate = prop.created_time;
        }

        // Get person/people
        if (prop.type === 'people' && prop.people?.length > 0) {
          assignee = prop.people.map((p: any) => p.name || p.person?.email || '').filter(Boolean).join(', ');
        }
        
        // Get select for assignee-like fields
        if (prop.type === 'select' && prop.select?.name && (key.includes('담당') || key.includes('assign'))) {
          assignee = prop.select.name;
        }
      }

      return {
        id: page.id,
        title: title || 'Untitled',
        date: createdDate,
        assignee,
        url: page.url,
      };
    });

    console.log('Processed projects:', projects.length);

    return new Response(JSON.stringify({ projects }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    console.error('Error fetching Notion projects:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
