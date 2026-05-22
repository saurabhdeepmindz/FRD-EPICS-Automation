-- ════════════════════════════════════════════════════════════════
-- Consolidated module schema (synthesized at RTM-generation time)
-- Source: 8 migration file(s) from LLD-PseudoCode/database/migrations/
-- Generated: 2026-05-15T02:37:47.872Z
-- ════════════════════════════════════════════════════════════════


-- ─── LLD-PseudoCode/database/migrations/001_create_research_conversation.sql ───
-- Migration: Create research_conversation table
-- Traceability: FRD: F-04-02 / EPIC: EPIC-04 / US: US-056 / ST: ST-US056-BE-03
-- Data Model Reference: §10 Schema Diagram, §9 Data Model Definitions

CREATE TABLE research_conversation (
    research_id UUID PRIMARY KEY,
    user_id UUID NOT NULL,
    query TEXT NOT NULL,
    status VARCHAR(32) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES users(user_id)
);

CREATE INDEX idx_research_conversation_user_id ON research_conversation(user_id);
CREATE INDEX idx_research_conversation_status ON research_conversation(status);

-- ─── LLD-PseudoCode/database/migrations/002_create_ai_response.sql ───
-- Migration: Create ai_response table
-- Traceability: FRD: F-04-02 / EPIC: EPIC-04 / US: US-056 / ST: ST-US056-BE-03
-- Data Model Reference: §10 Schema Diagram, §9 Data Model Definitions

CREATE TABLE ai_response (
    response_id UUID PRIMARY KEY,
    research_id UUID NOT NULL,
    response_text TEXT NOT NULL,
    confidence VARCHAR(16) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    CONSTRAINT fk_research FOREIGN KEY (research_id) REFERENCES research_conversation(research_id)
);

CREATE INDEX idx_ai_response_research_id ON ai_response(research_id);
CREATE INDEX idx_ai_response_confidence ON ai_response(confidence);

-- ─── LLD-PseudoCode/database/migrations/036_create_research_chats.sql ───
-- Migration: Create research_chats table for F-04-01 — Search Previous Research Chats
-- Traceability: FRD: F-04-01 / EPIC: EPIC-04 / US: US-053 / ST: ST-US053-BE-01
-- Data Model: See §10 Schema Diagram and §9 Data Model Definitions

CREATE TABLE research_chats (
    chat_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    title VARCHAR(255) NOT NULL,
    date TIMESTAMP WITH TIME ZONE NOT NULL,
    status VARCHAR(32) NOT NULL, -- OPEN | VERIFIED | ARCHIVED
    last_message TEXT,
    archived_flag BOOLEAN DEFAULT FALSE,
    CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES users(user_id)
);

CREATE INDEX idx_research_chats_user_id_date ON research_chats (user_id, date DESC);
CREATE INDEX idx_research_chats_user_id_status ON research_chats (user_id, status);

-- ─── LLD-PseudoCode/database/migrations/037_create_research_conversation.sql ───
-- @file        database/migrations/037_create_research_conversation.sql
-- @module      research-verification
-- @layer       migration
--
-- @description
-- Creates the research_conversation table with filterable fields and indices for hot lookup columns.
--
-- @frd       F-04-03
-- @epic      EPIC-04
-- @userStory US-059
-- @subTask   ST-US059-BE-01
--
-- @frdContext
-- Table for storing research conversations, filterable by user, date, status, verificationStatus, and archived flag.
--
CREATE TABLE research_conversation (
  conversation_id UUID PRIMARY KEY,
  user_id UUID NOT NULL,
  title VARCHAR(255) NOT NULL,
  date TIMESTAMP NOT NULL,
  status VARCHAR(32) NOT NULL,
  verification_status VARCHAR(32) NOT NULL,
  is_archived BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE INDEX idx_research_conversation_user_id ON research_conversation(user_id);
CREATE INDEX idx_research_conversation_date ON research_conversation(date);
CREATE INDEX idx_research_conversation_status ON research_conversation(status);
CREATE INDEX idx_research_conversation_verification_status ON research_conversation(verification_status);
CREATE INDEX idx_research_conversation_is_archived ON research_conversation(is_archived);

-- ─── LLD-PseudoCode/database/migrations/041_create_research_verification.sql ───
-- ============================================================
-- TRACEABILITY
-- ============================================================
-- Module:      MOD-04 — research-verification
-- Feature:     F-04-06 — View Verified Response
-- Epic:        EPIC-04 — Research Verification Workflow
-- User Story:  US-068 — Backend fetches verified response and professional details
-- SubTask:     ST-US068-BE-02
-- Data Model:  See §10 Schema Diagram, §18 Database Entities
-- ============================================================
-- Migration:   Create research_verification table
-- ============================================================

CREATE TABLE research_verification (
    research_id UUID PRIMARY KEY REFERENCES research_conversation(research_id),
    verified_response TEXT NOT NULL,
    verification_timestamp TIMESTAMPTZ NOT NULL,
    professional_id UUID NOT NULL REFERENCES professional(professional_id)
);

CREATE INDEX idx_research_verification_professional_id ON research_verification(professional_id);

-- ─── LLD-PseudoCode/database/migrations/042_create_professional.sql ───
-- ============================================================
-- TRACEABILITY
-- ============================================================
-- Module:      MOD-04 — research-verification
-- Feature:     F-04-06 — View Verified Response
-- Epic:        EPIC-04 — Research Verification Workflow
-- User Story:  US-068 — Backend fetches verified response and professional details
-- SubTask:     ST-US068-BE-02
-- Data Model:  See §10 Schema Diagram, §18 Database Entities
-- ============================================================
-- Migration:   Create professional table
-- ============================================================

CREATE TABLE professional (
    professional_id UUID PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    credentials VARCHAR(255) NOT NULL
);

CREATE UNIQUE INDEX idx_professional_name ON professional(name);

-- ─── LLD-PseudoCode/database/migrations/043_create_research_request.sql ───
-- ============================================================
-- TRACEABILITY
-- ============================================================
-- Module:      MOD-04 — research-verification
-- Package:     research-verification
-- Feature:     F-04-07 — View Verification Status
-- Feature Status: CONFIRMED-PARTIAL
-- Epic:        EPIC-04 — Research Verification Workflow
-- User Story:  US-071 — Backend provides verification status for research request
-- SubTask:     ST-US071-BE-02
-- Test Cases:  TC-US071-BE-001 to TC-US071-BE-005
-- ============================================================
-- §9 Data Model Definitions: ResearchRequest entity for status validation
-- ============================================================

CREATE TABLE IF NOT EXISTS research_requests (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    status VARCHAR(32) NOT NULL,
    verification_id UUID,
    CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX idx_research_requests_user_id ON research_requests(user_id);
CREATE INDEX idx_research_requests_status ON research_requests(status);

-- ─── LLD-PseudoCode/database/migrations/044_create_verification_package.sql ───
-- 
-- @file        database/migrations/044_create_verification_package.sql
-- @module      research-verification
-- @layer       migration
--
-- @description
-- Creates the verification_package table for storing purchasable verification packages.
--
-- @frd                F-04-09 — Purchase Verification Packages
-- @epic               EPIC-04 — Research Verification Workflow
-- @userStory          US-077 — Backend exposes available verification packages and initiates purchase session
-- @subTask            ST-US077-BE-01
-- @acceptanceCriteria
--  - AC-1: Only active packages may be purchased.
--
-- @frdContext
-- This migration creates the verification_package table, which stores all available verification packages for users to purchase. Each package has a unique ID, name, description, quantity, price, and isActive flag. Indexes are created for fast lookup by packageId and isActive.
--
-- @since 2026-04-28
--

CREATE TABLE verification_package (
    package_id UUID PRIMARY KEY,
    name VARCHAR(128) NOT NULL,
    description TEXT,
    quantity INTEGER NOT NULL,
    price NUMERIC(12,2) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_verification_package_active ON verification_package (is_active);