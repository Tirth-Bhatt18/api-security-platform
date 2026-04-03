-- User creation
INSERT INTO users (email, password_hash)
VALUES ($1, $2);

-- Get user by email
SELECT * FROM users WHERE email = $1;

-- Create scan
INSERT INTO scans (user_id, status)
VALUES ($1, 'pending')
RETURNING *;

-- Update scan status
UPDATE scans
SET status = $1
WHERE id = $2;

-- Insert result
INSERT INTO results (scan_id, endpoint, vulnerability, severity, details)
VALUES ($1, $2, $3, $4, $5);

-- Get scans for user
SELECT * FROM scans
WHERE user_id = $1
ORDER BY created_at DESC;

-- Get scan details
SELECT * FROM results
WHERE scan_id = $1;
