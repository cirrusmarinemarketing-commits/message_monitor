CREATE TABLE conversations (
    id BIGSERIAL PRIMARY KEY,
    conversation_id TEXT NOT NULL,
    channel TEXT NOT NULL,
    customer_name TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE (conversation_id, channel)
);

CREATE TABLE messages (
    id BIGSERIAL PRIMARY KEY,
    conversation_id TEXT NOT NULL,
    channel TEXT NOT NULL,
    external_id TEXT,
    role TEXT NOT NULL,
    sender_from TEXT,
    sender_to TEXT,
    message_timestamp TIMESTAMPTZ,
    message_type TEXT,
    text TEXT,
    subject TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE (channel, external_id)
);

CREATE TABLE conversation_analyses (
    id BIGSERIAL PRIMARY KEY,
    conversation_id TEXT NOT NULL,
    channel TEXT NOT NULL,

    intent TEXT,
    action TEXT,
    equipment TEXT,
    problem TEXT,
    location TEXT,
    request TEXT,
    amount NUMERIC,
    summary TEXT,
    customer_position TEXT,
    cirrus_position TEXT,
    pending_action TEXT,
    conversation_status TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE (conversation_id, channel)
);

CREATE TABLE service_cases (
    id TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL,
    channel TEXT NOT NULL,
    wa_id TEXT,
    customer_name TEXT,
    intent TEXT,
    equipment TEXT,
    problem TEXT,
    location TEXT,
    request TEXT,
    summary TEXT,
    status TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE human_handoffs (
    id TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL,
    channel TEXT NOT NULL,
    wa_id TEXT,
    customer_name TEXT,
    intent TEXT,
    problem TEXT,
    request TEXT,
    reason TEXT,
    status TEXT NOT NULL,
    assigned_to TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE activity_events (
    id TEXT PRIMARY KEY,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    channel TEXT,
    type TEXT NOT NULL,
    conversation_id TEXT,
    customer_name TEXT,
    status TEXT NOT NULL,
    message TEXT
);

CREATE INDEX idx_messages_conversation
ON messages(conversation_id, channel);

CREATE INDEX idx_activity_timestamp
ON activity_events(timestamp DESC);

CREATE INDEX idx_cases_created
ON service_cases(created_at DESC);

CREATE INDEX idx_handoffs_created
ON human_handoffs(created_at DESC);