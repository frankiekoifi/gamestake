-- scripts/init-db.sql
-- Create extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create custom types
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('user', 'admin', 'moderator');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE transaction_type AS ENUM (
        'deposit', 'withdrawal', 'match_entry', 'match_winning', 
        'match_refund', 'tournament_entry', 'tournament_winning', 
        'fee_deduction', 'referral_bonus'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE transaction_status AS ENUM ('pending', 'completed', 'failed', 'cancelled', 'refunded');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE match_status AS ENUM (
        'pending', 'accepted', 'in_progress', 'completed', 'disputed', 'cancelled', 'expired'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE tournament_type AS ENUM ('knockout', 'round_robin', 'bracket');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status);
CREATE INDEX IF NOT EXISTS idx_matches_status ON matches(status);
CREATE INDEX IF NOT EXISTS idx_matches_game ON matches(game);

-- Create admin user (password will be set by application)
INSERT INTO users (id, email, username, password, role, is_verified, created_at, updated_at)
VALUES (
    uuid_generate_v4(),
    'admin@gamestakearena.com',
    'admin',
    crypt('Admin123!', gen_salt('bf')),
    'admin',
    true,
    NOW(),
    NOW()
) ON CONFLICT (email) DO NOTHING;

-- Create platform earnings record
INSERT INTO platform_earnings (id, total_earnings, total_fees_collected, total_matches_played, created_at, updated_at)
VALUES (uuid_generate_v4(), 0, 0, 0, NOW(), NOW())
ON CONFLICT DO NOTHING;