#!/bin/bash
set -e

echo "🚀 Setting up Global Leaderboard for Obama Approximation"
echo ""

# Check if Supabase CLI is installed
if ! command -v supabase &> /dev/null; then
    echo "📦 Installing Supabase CLI..."
    npm install -g supabase
fi

echo "✅ Supabase CLI installed"
echo ""

# Login to Supabase
echo "🔐 Logging into Supabase..."
echo "   (This will open your browser for authentication)"
supabase login

echo ""
echo "📝 Next steps:"
echo ""
echo "1. Create a new Supabase project:"
echo "   Visit: https://supabase.com/dashboard"
echo "   Click 'New Project'"
echo "   Name: obama-approximation"
echo "   Region: Choose closest to you"
echo "   Password: (save this!)"
echo ""
echo "2. Link your project:"
echo "   supabase link --project-ref YOUR_PROJECT_REF"
echo "   (Find YOUR_PROJECT_REF in Supabase dashboard settings)"
echo ""
echo "3. Push database migrations:"
echo "   supabase db push"
echo ""
echo "4. Get your credentials:"
echo "   Visit: https://supabase.com/dashboard/project/YOUR_PROJECT_REF/settings/api"
echo "   Copy 'Project URL' and 'anon public' key"
echo ""
echo "5. Create .env.local:"
echo "   cp .env.local.example .env.local"
echo "   Edit .env.local with your credentials"
echo ""
echo "6. Install dependencies:"
echo "   npm install"
echo ""
echo "7. Test locally:"
echo "   npm run dev"
echo ""
echo "8. Deploy to Vercel:"
echo "   vercel"
echo "   (Add environment variables in Vercel dashboard)"
echo ""
echo "📖 Full guide: See DEPLOYMENT.md"
echo ""

