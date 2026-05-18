-- Enable RLS on posts table and allow authenticated inserts

-- Enable RLS
a lter table posts enable row level security;

-- Policy: Allow authenticated users to insert
create policy "Allow authenticated inserts" on posts
for insert
using (auth.uid() IS NOT NULL);
