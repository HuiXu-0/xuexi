-- =============================================================================
-- 校园学习资源共享与知识协作平台 · 数据库结构
-- MySQL 8.x
--
-- 对应《校园学习资源共享平台_三大Agent可执行设计与领域本体_V1.0》
--   §2 统一领域本体　§7 数据库逻辑模型
--
-- 与设计书的差异（MySQL vs PostgreSQL）：
--   1. 向量检索：PostgreSQL 用 pgvector；MySQL 8 无原生向量类型，
--      本方案把 embedding 存 JSON，应用层算余弦相似度。
--      当前数据量（几十条）完全够用；上万条后应换专用向量库。
--   2. 全文检索：MySQL 用 InnoDB FULLTEXT + **ngram 解析器**（中文必需，
--      默认 latin parser 对中文无效）。
--
-- 执行：mysql -u root -p < schema.sql
-- =============================================================================

CREATE DATABASE IF NOT EXISTS campus_platform
  DEFAULT CHARACTER SET utf8mb4
  DEFAULT COLLATE utf8mb4_unicode_ci;

USE campus_platform;

-- ── 用户 / 角色 / 权限 / 能力位 ──────────────────────────────

CREATE TABLE IF NOT EXISTS users (
  id              VARCHAR(64)   NOT NULL,
  display_name    VARCHAR(128)  NOT NULL,
  email           VARCHAR(255)  NULL,
  password_hash   VARCHAR(255)  NOT NULL,
  status          VARCHAR(32)   NOT NULL DEFAULT 'active',
  violations      INT           NOT NULL DEFAULT 0,
  restriction     VARCHAR(32)   NULL,
  created_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_email (email),
  KEY ix_users_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS roles (
  id          VARCHAR(64)  NOT NULL,
  code        VARCHAR(64)  NOT NULL,
  name        VARCHAR(64)  NOT NULL,
  description VARCHAR(255) NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_roles_code (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS permissions (
  id          VARCHAR(64)  NOT NULL,
  code        VARCHAR(128) NOT NULL,
  scope       VARCHAR(64)  NULL,
  description VARCHAR(255) NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_permissions_code (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS user_roles (
  user_id    VARCHAR(64)  NOT NULL,
  role_id    VARCHAR(64)  NOT NULL,
  granted_by VARCHAR(64)  NULL,
  granted_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, role_id),
  KEY ix_user_roles_role (role_id),
  CONSTRAINT fk_user_roles_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_user_roles_role FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS role_permissions (
  role_id       VARCHAR(64) NOT NULL,
  permission_id VARCHAR(64) NOT NULL,
  PRIMARY KEY (role_id, permission_id),
  KEY ix_role_permissions_perm (permission_id),
  CONSTRAINT fk_role_permissions_role FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
  CONSTRAINT fk_role_permissions_perm FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 授权范围（§12 能力位 scope_grant）
CREATE TABLE IF NOT EXISTS scope_grants (
  id             VARCHAR(64)  NOT NULL,
  label          VARCHAR(128) NOT NULL,
  resource_types TEXT         NOT NULL,
  subject_ids    TEXT         NOT NULL,
  group_ids      TEXT         NOT NULL,
  note           TEXT         NULL,
  created_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 能力位：group_owner / content_admin / reviewer
CREATE TABLE IF NOT EXISTS user_capabilities (
  id             VARCHAR(64) NOT NULL,
  user_id        VARCHAR(64) NOT NULL,
  code           VARCHAR(64) NOT NULL,
  scope_grant_id VARCHAR(64) NULL,
  granted_by     VARCHAR(64) NULL,
  granted_at     DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  revoked_at     DATETIME    NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_user_capability (user_id, code),
  KEY ix_user_capabilities_user (user_id),
  CONSTRAINT fk_user_capabilities_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_user_capabilities_scope FOREIGN KEY (scope_grant_id) REFERENCES scope_grants(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── 资源主表 + 扩展表 ───────────────────────────────────────

CREATE TABLE IF NOT EXISTS resources (
  id                 VARCHAR(64)   NOT NULL,
  resource_type      VARCHAR(32)   NOT NULL,
  title              VARCHAR(255)  NOT NULL,
  summary            TEXT          NULL,
  author_id          VARCHAR(64)   NULL,
  created_by         VARCHAR(64)   NULL,
  status             VARCHAR(32)   NOT NULL DEFAULT 'draft',
  visibility         VARCHAR(32)   NOT NULL DEFAULT 'campus',
  license_code       VARCHAR(32)   NOT NULL DEFAULT 'all_rights_reserved',
  category_id        VARCHAR(64)   NULL,
  difficulty         VARCHAR(32)   NULL,
  language           VARCHAR(16)   NULL,
  published_at       DATETIME      NULL,
  updated_at         DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  last_verified_at   DATETIME      NULL,
  source_type        VARCHAR(32)   NOT NULL DEFAULT 'student',
  source_url         TEXT          NULL,
  source_note        VARCHAR(255)  NULL,
  content_hash       VARCHAR(64)   NULL,
  version            INT           NOT NULL DEFAULT 1,
  quality_score      DOUBLE        NOT NULL DEFAULT 0.5,
  teacher_recommended TINYINT(1)   NOT NULL DEFAULT 0,
  featured           TINYINT(1)   NOT NULL DEFAULT 0,
  created_at         DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ft_search_text     TEXT          NULL,
  PRIMARY KEY (id),
  KEY ix_resources_type_status (resource_type, status),
  KEY ix_resources_visibility (visibility),
  KEY ix_resources_author (author_id),
  KEY ix_resources_updated (updated_at),
  CONSTRAINT fk_resources_author FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 中文全文索引：ngram 解析器（MySQL 8.0.16+ 的 InnoDB FULLTEXT 必需）
ALTER TABLE resources
  ADD FULLTEXT KEY ft_search_text (ft_search_text) WITH PARSER ngram;

CREATE TABLE IF NOT EXISTS resource_notes (
  resource_id VARCHAR(64) NOT NULL,
  body        TEXT        NOT NULL,
  PRIMARY KEY (resource_id),
  CONSTRAINT fk_resource_notes_resource FOREIGN KEY (resource_id) REFERENCES resources(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS resource_external_links (
  resource_id     VARCHAR(64) NOT NULL,
  url             TEXT        NULL,
  source_platform VARCHAR(128) NULL,
  link_status     VARCHAR(32) NOT NULL DEFAULT 'unknown',
  PRIMARY KEY (resource_id),
  CONSTRAINT fk_resource_external_resource FOREIGN KEY (resource_id) REFERENCES resources(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS resource_project_cases (
  resource_id         VARCHAR(64) NOT NULL,
  project_goal        TEXT        NULL,
  implementation_summary TEXT     NULL,
  authorization_state VARCHAR(32) NOT NULL DEFAULT 'pending',
  team_members        TEXT        NULL,
  PRIMARY KEY (resource_id),
  CONSTRAINT fk_resource_cases_resource FOREIGN KEY (resource_id) REFERENCES resources(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS resource_competitions (
  resource_id        VARCHAR(64) NOT NULL,
  organizer          VARCHAR(255) NULL,
  official_url       TEXT        NULL,
  registration_start DATE        NULL,
  registration_end   DATE        NULL,
  date_certainty     VARCHAR(32) NOT NULL DEFAULT 'unknown',
  categories         VARCHAR(255) NULL,
  PRIMARY KEY (resource_id),
  CONSTRAINT fk_resource_competitions_resource FOREIGN KEY (resource_id) REFERENCES resources(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS resource_official_notices (
  resource_id   VARCHAR(64) NOT NULL,
  publisher_org VARCHAR(128) NULL,
  effective_at  DATETIME    NULL,
  expires_at    DATETIME    NULL,
  importance    VARCHAR(16) NOT NULL DEFAULT 'normal',
  pinned        TINYINT(1)  NOT NULL DEFAULT 0,
  body          TEXT        NULL,
  PRIMARY KEY (resource_id),
  CONSTRAINT fk_resource_notices_resource FOREIGN KEY (resource_id) REFERENCES resources(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS forum_groups (
  id           VARCHAR(64)  NOT NULL,
  name         VARCHAR(255) NOT NULL,
  description  TEXT         NULL,
  creator_id   VARCHAR(64)  NULL,
  join_policy  VARCHAR(32)  NOT NULL DEFAULT 'approve',
  visibility   VARCHAR(32)  NOT NULL DEFAULT 'campus',
  status       VARCHAR(32)  NOT NULL DEFAULT 'active',
  channels     TEXT         NOT NULL,
  rules        TEXT         NOT NULL,
  member_count INT          NOT NULL DEFAULT 0,
  created_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY ix_forum_groups_creator (creator_id),
  CONSTRAINT fk_forum_groups_creator FOREIGN KEY (creator_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS forum_posts (
  id              VARCHAR(64)  NOT NULL,
  group_id        VARCHAR(64)  NULL,
  parent_post_id  VARCHAR(64)  NULL,
  author_id       VARCHAR(64)  NULL,
  title           VARCHAR(255) NOT NULL,
  body            TEXT         NOT NULL,
  kind            VARCHAR(32)  NULL,
  status          VARCHAR(32)  NOT NULL DEFAULT 'published',
  created_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY ix_forum_posts_group (group_id),
  KEY ix_forum_posts_author (author_id),
  CONSTRAINT fk_forum_posts_group FOREIGN KEY (group_id) REFERENCES forum_groups(id) ON DELETE CASCADE,
  CONSTRAINT fk_forum_posts_author FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS categories (
  id        VARCHAR(64)  NOT NULL,
  name      VARCHAR(128) NOT NULL,
  parent_id VARCHAR(64)  NULL,
  kind      VARCHAR(32)  NOT NULL DEFAULT 'resource',
  status    VARCHAR(32)  NOT NULL DEFAULT 'active',
  note      VARCHAR(255) NULL,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS tags (
  id               VARCHAR(64)  NOT NULL,
  name             VARCHAR(128) NOT NULL,
  tag_group        VARCHAR(32)  NOT NULL DEFAULT 'tech',
  canonical_tag_id VARCHAR(64)  NULL,
  status           VARCHAR(32)  NOT NULL DEFAULT 'active',
  PRIMARY KEY (id),
  UNIQUE KEY uq_tag_name_group (name, tag_group)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS resource_tags (
  resource_id VARCHAR(64) NOT NULL,
  tag_id      VARCHAR(64) NOT NULL,
  PRIMARY KEY (resource_id, tag_id),
  KEY ix_resource_tags_tag (tag_id),
  CONSTRAINT fk_resource_tags_resource FOREIGN KEY (resource_id) REFERENCES resources(id) ON DELETE CASCADE,
  CONSTRAINT fk_resource_tags_tag FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 向量分片（MySQL 无原生向量类型，embedding 存 JSON）
CREATE TABLE IF NOT EXISTS resource_embedding_chunks (
  id              VARCHAR(64) NOT NULL,
  resource_id     VARCHAR(64) NOT NULL,
  chunk_index     INT         NOT NULL DEFAULT 0,
  chunk_text      TEXT        NULL,
  embedding_json  MEDIUMTEXT  NULL,
  embedding_model VARCHAR(64) NULL,
  indexed_at      DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_embedding_chunk (resource_id, chunk_index),
  KEY ix_embedding_resource (resource_id),
  CONSTRAINT fk_embedding_resource FOREIGN KEY (resource_id) REFERENCES resources(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── 审核治理 ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS moderation_rules (
  id         VARCHAR(64)  NOT NULL,
  name       VARCHAR(255) NOT NULL,
  rule_type  VARCHAR(32)  NOT NULL DEFAULT 'semantic',
  scope      VARCHAR(255) NOT NULL,
  severity   VARCHAR(16)  NOT NULL DEFAULT 'medium',
  enabled    TINYINT(1)   NOT NULL DEFAULT 1,
  body       TEXT         NOT NULL,
  created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY ix_rules_enabled (enabled)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS moderation_rule_versions (
  id            VARCHAR(64) NOT NULL,
  rule_id       VARCHAR(64) NOT NULL,
  version       INT         NOT NULL,
  body          TEXT        NOT NULL,
  change_reason TEXT        NOT NULL,
  created_by    VARCHAR(64) NULL,
  created_at    DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  is_current    TINYINT(1)  NOT NULL DEFAULT 1,
  PRIMARY KEY (id),
  KEY ix_rule_version_rule (rule_id, version),
  CONSTRAINT fk_rule_versions_rule FOREIGN KEY (rule_id) REFERENCES moderation_rules(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS moderation_cases (
  id                    VARCHAR(64) NOT NULL,
  content_type          VARCHAR(32) NOT NULL,
  content_id            VARCHAR(64) NOT NULL,
  content_version       INT        NOT NULL DEFAULT 1,
  content_hash          VARCHAR(64) NULL,
  snapshot              TEXT       NOT NULL,
  submitter_id          VARCHAR(64) NULL,
  status                VARCHAR(32) NOT NULL DEFAULT 'created',
  assigned_reviewer_id  VARCHAR(64) NULL,
  scope_grant_id        VARCHAR(64) NULL,
  created_at            DATETIME   NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at            DATETIME   NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY ix_case_status (status),
  KEY ix_case_target (content_type, content_id),
  KEY ix_case_reviewer (assigned_reviewer_id),
  CONSTRAINT fk_cases_submitter FOREIGN KEY (submitter_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS moderation_decisions (
  id                  VARCHAR(64) NOT NULL,
  case_id             VARCHAR(64) NOT NULL,
  decision            VARCHAR(16) NOT NULL,
  risk_categories     TEXT        NOT NULL,
  risk_level          VARCHAR(16) NOT NULL DEFAULT 'low',
  evidence            TEXT        NOT NULL,
  uncertainty_reasons TEXT        NOT NULL,
  rule_hits           TEXT        NOT NULL,
  reasoning           TEXT        NULL,
  rule_version        VARCHAR(64) NULL,
  model_version       VARCHAR(64) NULL,
  prompt_version      VARCHAR(64) NULL,
  confidence          DOUBLE      NULL,
  produced_by         VARCHAR(32) NOT NULL DEFAULT 'agent',
  created_at          DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY ix_decisions_case (case_id),
  CONSTRAINT fk_decisions_case FOREIGN KEY (case_id) REFERENCES moderation_cases(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS moderation_reviews (
  id             VARCHAR(64) NOT NULL,
  case_id        VARCHAR(64) NOT NULL,
  reviewer_id    VARCHAR(64) NULL,
  reviewer_type  VARCHAR(16) NOT NULL DEFAULT 'admin',
  action         VARCHAR(32) NOT NULL,
  reason         TEXT        NOT NULL,
  overrode_agent TINYINT(1)  NOT NULL DEFAULT 0,
  created_at     DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY ix_reviews_case (case_id),
  CONSTRAINT fk_reviews_case FOREIGN KEY (case_id) REFERENCES moderation_cases(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS reports (
  id          VARCHAR(64) NOT NULL,
  reporter_id VARCHAR(64) NULL,
  target_type VARCHAR(32) NOT NULL,
  target_id   VARCHAR(64) NOT NULL,
  reason      TEXT        NOT NULL,
  status      VARCHAR(32) NOT NULL DEFAULT 'submitted',
  created_at  DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY ix_reports_target (target_type, target_id),
  CONSTRAINT fk_reports_reporter FOREIGN KEY (reporter_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS appeals (
  id           VARCHAR(64) NOT NULL,
  case_id      VARCHAR(64) NOT NULL,
  appellant_id VARCHAR(64) NULL,
  reason       TEXT        NOT NULL,
  status       VARCHAR(32) NOT NULL DEFAULT 'submitted',
  created_at   DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY ix_appeals_case (case_id),
  CONSTRAINT fk_appeals_case FOREIGN KEY (case_id) REFERENCES moderation_cases(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── 知识本体 ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS knowledge_domains (
  id          VARCHAR(64)  NOT NULL,
  name        VARCHAR(128) NOT NULL,
  description TEXT         NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_domains_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS knowledge_concepts (
  id             VARCHAR(64)  NOT NULL,
  canonical_name VARCHAR(128) NOT NULL,
  description    TEXT         NULL,
  domain_id      VARCHAR(64)  NULL,
  difficulty     VARCHAR(32)  NOT NULL DEFAULT 'unknown',
  status         VARCHAR(32)  NOT NULL DEFAULT 'active',
  PRIMARY KEY (id),
  UNIQUE KEY uq_concepts_name (canonical_name),
  KEY ix_concepts_domain (domain_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS knowledge_relations (
  id               VARCHAR(64) NOT NULL,
  source_id        VARCHAR(64) NOT NULL,
  relation_type    VARCHAR(32) NOT NULL DEFAULT 'prerequisite_of',
  target_id        VARCHAR(64) NOT NULL,
  weight           DOUBLE      NULL,
  confidence_label VARCHAR(32) NOT NULL DEFAULT 'unknown',
  source_type      VARCHAR(32) NOT NULL DEFAULT 'teacher',
  source_ref_id    VARCHAR(64) NULL,
  version          INT         NOT NULL DEFAULT 1,
  created_at       DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_knowledge_relation (source_id, relation_type, target_id),
  KEY ix_kr_source (source_id, relation_type),
  KEY ix_kr_target (target_id, relation_type),
  CONSTRAINT fk_kr_source FOREIGN KEY (source_id) REFERENCES knowledge_concepts(id) ON DELETE CASCADE,
  CONSTRAINT fk_kr_target FOREIGN KEY (target_id) REFERENCES knowledge_concepts(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS skills (
  id                  VARCHAR(64)  NOT NULL,
  name                VARCHAR(128) NOT NULL,
  description         TEXT         NULL,
  assessment_method   VARCHAR(255) NULL,
  status              VARCHAR(32)  NOT NULL DEFAULT 'active',
  PRIMARY KEY (id),
  UNIQUE KEY uq_skills_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS skill_concept_relations (
  id               VARCHAR(64) NOT NULL,
  skill_id         VARCHAR(64) NOT NULL,
  concept_id       VARCHAR(64) NOT NULL,
  confidence_label VARCHAR(32) NOT NULL DEFAULT 'unknown',
  source_type      VARCHAR(32) NOT NULL DEFAULT 'teacher',
  PRIMARY KEY (id),
  UNIQUE KEY uq_skill_concept (skill_id, concept_id),
  KEY ix_scr_concept (concept_id),
  CONSTRAINT fk_scr_skill FOREIGN KEY (skill_id) REFERENCES skills(id) ON DELETE CASCADE,
  CONSTRAINT fk_scr_concept FOREIGN KEY (concept_id) REFERENCES knowledge_concepts(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS resource_concepts (
  id               VARCHAR(64) NOT NULL,
  resource_id      VARCHAR(64) NOT NULL,
  concept_id       VARCHAR(64) NOT NULL,
  relation_type    VARCHAR(32) NOT NULL DEFAULT 'about',
  confidence_label VARCHAR(32) NOT NULL DEFAULT 'unknown',
  source_type      VARCHAR(32) NOT NULL DEFAULT 'teacher',
  PRIMARY KEY (id),
  UNIQUE KEY uq_res_concept (resource_id, concept_id, relation_type),
  KEY ix_res_concepts_concept (concept_id),
  CONSTRAINT fk_res_concepts_resource FOREIGN KEY (resource_id) REFERENCES resources(id) ON DELETE CASCADE,
  CONSTRAINT fk_res_concepts_concept FOREIGN KEY (concept_id) REFERENCES knowledge_concepts(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS ontology_change_requests (
  id            VARCHAR(64) NOT NULL,
  relation_type VARCHAR(32) NOT NULL,
  source_id     VARCHAR(64) NOT NULL,
  target_id     VARCHAR(64) NOT NULL,
  reason        TEXT        NOT NULL,
  source_type   VARCHAR(32) NOT NULL DEFAULT 'agent_suggestion',
  status        VARCHAR(32) NOT NULL DEFAULT 'proposed',
  reviewed_by   VARCHAR(64) NULL,
  created_at    DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY ix_ocr_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── 学习过程 ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS learning_profiles (
  user_id         VARCHAR(64) NOT NULL,
  profile_version INT         NOT NULL DEFAULT 1,
  basics          TEXT        NOT NULL,
  preferences     TEXT        NOT NULL,
  updated_at      DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id),
  CONSTRAINT fk_profiles_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS learning_goals (
  id                      VARCHAR(64)  NOT NULL,
  user_id                 VARCHAR(64)  NOT NULL,
  title                   VARCHAR(255) NOT NULL,
  goal_type               VARCHAR(32)  NOT NULL DEFAULT 'skill_learning',
  target_outcomes         TEXT         NOT NULL,
  target_date             DATE         NULL,
  weekly_available_minutes INT         NULL,
  current_level           VARCHAR(64)  NULL,
  constraints             TEXT         NOT NULL,
  status                  VARCHAR(32)  NOT NULL DEFAULT 'active',
  created_at              DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY ix_goals_user (user_id),
  CONSTRAINT fk_goals_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS capability_evidence (
  id               VARCHAR(64) NOT NULL,
  user_id          VARCHAR(64) NOT NULL,
  concept_id       VARCHAR(64) NULL,
  skill_id         VARCHAR(64) NULL,
  evidence_type    VARCHAR(32) NOT NULL DEFAULT 'UNKNOWN',
  capability_state VARCHAR(32) NOT NULL DEFAULT 'unknown',
  source_id        VARCHAR(64) NULL,
  source_note      TEXT        NULL,
  observed_at      DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY ix_evidence_user (user_id, concept_id),
  CONSTRAINT fk_evidence_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS learning_plans (
  id           VARCHAR(64) NOT NULL,
  user_id      VARCHAR(64) NOT NULL,
  goal_id      VARCHAR(64) NULL,
  version      INT        NOT NULL DEFAULT 1,
  status       VARCHAR(32) NOT NULL DEFAULT 'draft',
  assumptions  TEXT       NOT NULL,
  lock_version INT        NOT NULL DEFAULT 1,
  created_at   DATETIME   NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   DATETIME   NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY ix_plans_user (user_id),
  KEY ix_plans_goal (goal_id),
  CONSTRAINT fk_plans_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_plans_goal FOREIGN KEY (goal_id) REFERENCES learning_goals(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS learning_plan_stages (
  id                VARCHAR(64)  NOT NULL,
  plan_id           VARCHAR(64)  NOT NULL,
  sequence          INT          NOT NULL,
  title             VARCHAR(255) NOT NULL,
  objective         TEXT         NULL,
  success_criteria  TEXT         NOT NULL,
  PRIMARY KEY (id),
  KEY ix_stage_plan (plan_id, sequence),
  CONSTRAINT fk_stages_plan FOREIGN KEY (plan_id) REFERENCES learning_plans(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS learning_tasks (
  id                   VARCHAR(64)  NOT NULL,
  stage_id             VARCHAR(64)  NOT NULL,
  title                VARCHAR(255) NOT NULL,
  estimated_minutes    INT          NULL,
  status               VARCHAR(32)  NOT NULL DEFAULT 'pending',
  completion_criteria  TEXT         NOT NULL,
  evidence_required    TEXT         NOT NULL,
  depends_on           TEXT         NOT NULL,
  created_at           DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY ix_task_stage (stage_id),
  CONSTRAINT fk_tasks_stage FOREIGN KEY (stage_id) REFERENCES learning_plan_stages(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 任务引用资源：ON DELETE RESTRICT —— 资源删除不能级联删掉计划历史（§2.4 约束 7）
CREATE TABLE IF NOT EXISTS learning_task_resources (
  id          VARCHAR(64) NOT NULL,
  task_id     VARCHAR(64) NOT NULL,
  resource_id VARCHAR(64) NOT NULL,
  PRIMARY KEY (id),
  KEY ix_task_resources_task (task_id),
  CONSTRAINT fk_task_resources_task FOREIGN KEY (task_id) REFERENCES learning_tasks(id) ON DELETE CASCADE,
  CONSTRAINT fk_task_resources_resource FOREIGN KEY (resource_id) REFERENCES resources(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS learning_task_concepts (
  id         VARCHAR(64) NOT NULL,
  task_id    VARCHAR(64) NOT NULL,
  concept_id VARCHAR(64) NOT NULL,
  PRIMARY KEY (id),
  KEY ix_task_concepts_task (task_id),
  CONSTRAINT fk_task_concepts_task FOREIGN KEY (task_id) REFERENCES learning_tasks(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS learning_task_skills (
  id       VARCHAR(64) NOT NULL,
  task_id  VARCHAR(64) NOT NULL,
  skill_id VARCHAR(64) NOT NULL,
  PRIMARY KEY (id),
  KEY ix_task_skills_task (task_id),
  CONSTRAINT fk_task_skills_task FOREIGN KEY (task_id) REFERENCES learning_tasks(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS learning_activities (
  id            VARCHAR(64) NOT NULL,
  user_id       VARCHAR(64) NOT NULL,
  task_id       VARCHAR(64) NULL,
  activity_type VARCHAR(32) NOT NULL,
  detail        TEXT        NOT NULL,
  created_at    DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY ix_activities_user (user_id),
  CONSTRAINT fk_activities_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── 审计与反馈 ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS audit_events (
  id          VARCHAR(64) NOT NULL,
  actor_type  VARCHAR(32) NOT NULL DEFAULT 'user',
  actor_id    VARCHAR(64) NULL,
  action      VARCHAR(64) NOT NULL,
  target_type VARCHAR(32) NOT NULL,
  target_id   VARCHAR(64) NULL,
  reason      TEXT        NOT NULL,
  result      TEXT        NOT NULL,
  case_no     VARCHAR(64) NULL,
  trace_id    VARCHAR(64) NULL,
  detail      TEXT        NOT NULL,
  created_at  DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY ix_audit_target (target_type, target_id),
  KEY ix_audit_actor (actor_type, actor_id),
  KEY ix_audit_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 反馈闭环（§10.3.2）：误判反馈必须能归因到具体规则
CREATE TABLE IF NOT EXISTS agent_feedback (
  id              VARCHAR(64) NOT NULL,
  agent_name      VARCHAR(32) NOT NULL,
  run_id          VARCHAR(64) NULL,
  request_id      VARCHAR(64) NULL,
  user_id         VARCHAR(64) NULL,
  target_type     VARCHAR(32) NOT NULL,
  target_id       VARCHAR(64) NOT NULL,
  feedback_type   VARCHAR(32) NOT NULL,
  reason_code     VARCHAR(32) NOT NULL,
  reason_text     TEXT        NULL,
  matched_rule_id VARCHAR(64) NULL,
  rule_version    VARCHAR(64) NULL,
  severity        VARCHAR(16) NOT NULL DEFAULT 'low',
  status          VARCHAR(32) NOT NULL DEFAULT 'new',
  triaged_by      VARCHAR(64) NULL,
  triaged_at      DATETIME    NULL,
  resolution_note TEXT        NULL,
  created_at      DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY ix_feedback_agent (agent_name, status),
  KEY ix_feedback_target (target_type, target_id),
  KEY ix_feedback_rule (matched_rule_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS agent_runs (
  id              VARCHAR(64) NOT NULL,
  agent_name      VARCHAR(32) NOT NULL,
  agent_version   VARCHAR(64) NULL,
  prompt_version  VARCHAR(64) NULL,
  model_profile   VARCHAR(64) NULL,
  model_name      VARCHAR(64) NULL,
  request_id      VARCHAR(64) NULL,
  trace_id        VARCHAR(64) NULL,
  user_id         VARCHAR(64) NULL,
  input_digest    VARCHAR(64) NULL,
  tools_called    TEXT        NULL,
  duration_ms     INT         NULL,
  token_usage     INT         NULL,
  cost            DOUBLE      NULL,
  final_status    VARCHAR(32) NULL,
  error_code      VARCHAR(64) NULL,
  output_valid    TINYINT(1)  NULL,
  created_at      DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY ix_runs_agent (agent_name, created_at),
  KEY ix_runs_request (request_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
