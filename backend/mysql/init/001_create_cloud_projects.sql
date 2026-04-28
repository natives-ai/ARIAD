-- 이 파일은 로컬 MySQL 초기 구동 시 영속화 정규화 테이블을 생성합니다.

CREATE TABLE IF NOT EXISTS cloud_projects (
  account_id VARCHAR(191) NOT NULL,
  project_id VARCHAR(191) NOT NULL,
  project_title TEXT NULL,
  project_summary MEDIUMTEXT NULL,
  project_active_episode_id VARCHAR(191) NULL,
  project_created_at VARCHAR(40) NULL,
  project_updated_at VARCHAR(40) NULL,
  linkage_entity_id VARCHAR(191) NULL,
  linkage_cloud_linked TINYINT(1) NULL,
  linkage_linked_account_id VARCHAR(191) NULL,
  linkage_last_imported_at VARCHAR(40) NULL,
  linkage_last_synced_at VARCHAR(40) NULL,
  linkage_json JSON NULL,
  snapshot_json JSON NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (account_id, project_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS cloud_accounts (
  account_id VARCHAR(191) NOT NULL,
  auth_provider VARCHAR(32) NOT NULL DEFAULT 'unknown',
  provider_subject VARCHAR(191) NULL,
  email VARCHAR(320) NULL,
  display_name VARCHAR(255) NULL,
  avatar_url MEDIUMTEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (account_id),
  UNIQUE KEY uq_cloud_accounts_provider_subject (auth_provider, provider_subject),
  UNIQUE KEY uq_cloud_accounts_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS cloud_sessions (
  session_id VARCHAR(191) NOT NULL,
  account_id VARCHAR(191) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at DATETIME NOT NULL,
  revoked_at DATETIME NULL,
  user_agent_hash VARCHAR(64) NULL,
  PRIMARY KEY (session_id),
  INDEX idx_cloud_sessions_account_id (account_id),
  INDEX idx_cloud_sessions_expires_at (expires_at),
  CONSTRAINT fk_cloud_sessions_account
    FOREIGN KEY (account_id)
    REFERENCES cloud_accounts (account_id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS cloud_episodes (
  account_id VARCHAR(191) NOT NULL,
  project_id VARCHAR(191) NOT NULL,
  episode_id VARCHAR(191) NOT NULL,
  title TEXT NOT NULL,
  objective MEDIUMTEXT NOT NULL,
  endpoint MEDIUMTEXT NOT NULL,
  created_at VARCHAR(40) NOT NULL,
  updated_at VARCHAR(40) NOT NULL,
  PRIMARY KEY (account_id, project_id, episode_id),
  CONSTRAINT fk_cloud_episodes_project
    FOREIGN KEY (account_id, project_id)
    REFERENCES cloud_projects (account_id, project_id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS cloud_objects (
  account_id VARCHAR(191) NOT NULL,
  project_id VARCHAR(191) NOT NULL,
  object_id VARCHAR(191) NOT NULL,
  episode_id VARCHAR(191) NOT NULL,
  category VARCHAR(32) NOT NULL,
  name VARCHAR(255) NOT NULL,
  summary MEDIUMTEXT NOT NULL,
  created_at VARCHAR(40) NOT NULL,
  updated_at VARCHAR(40) NOT NULL,
  PRIMARY KEY (account_id, project_id, object_id),
  INDEX idx_cloud_objects_episode (account_id, project_id, episode_id),
  CONSTRAINT fk_cloud_objects_project
    FOREIGN KEY (account_id, project_id)
    REFERENCES cloud_projects (account_id, project_id)
    ON DELETE CASCADE,
  CONSTRAINT fk_cloud_objects_episode
    FOREIGN KEY (account_id, project_id, episode_id)
    REFERENCES cloud_episodes (account_id, project_id, episode_id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS cloud_nodes (
  account_id VARCHAR(191) NOT NULL,
  project_id VARCHAR(191) NOT NULL,
  node_id VARCHAR(191) NOT NULL,
  episode_id VARCHAR(191) NOT NULL,
  parent_id VARCHAR(191) NULL,
  node_level VARCHAR(16) NOT NULL,
  content_mode VARCHAR(16) NOT NULL,
  text_value MEDIUMTEXT NOT NULL,
  is_collapsed TINYINT(1) NULL,
  is_important TINYINT(1) NULL,
  is_fixed TINYINT(1) NULL,
  canvas_x DOUBLE NULL,
  canvas_y DOUBLE NULL,
  canvas_width DOUBLE NULL,
  canvas_height DOUBLE NULL,
  order_index INT NOT NULL,
  created_at VARCHAR(40) NOT NULL,
  updated_at VARCHAR(40) NOT NULL,
  PRIMARY KEY (account_id, project_id, node_id),
  INDEX idx_cloud_nodes_episode (account_id, project_id, episode_id),
  INDEX idx_cloud_nodes_parent (account_id, project_id, parent_id),
  CONSTRAINT fk_cloud_nodes_project
    FOREIGN KEY (account_id, project_id)
    REFERENCES cloud_projects (account_id, project_id)
    ON DELETE CASCADE,
  CONSTRAINT fk_cloud_nodes_episode
    FOREIGN KEY (account_id, project_id, episode_id)
    REFERENCES cloud_episodes (account_id, project_id, episode_id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS cloud_node_keywords (
  account_id VARCHAR(191) NOT NULL,
  project_id VARCHAR(191) NOT NULL,
  node_id VARCHAR(191) NOT NULL,
  keyword_order INT NOT NULL,
  keyword_value VARCHAR(255) NOT NULL,
  PRIMARY KEY (account_id, project_id, node_id, keyword_order),
  CONSTRAINT fk_cloud_node_keywords_node
    FOREIGN KEY (account_id, project_id, node_id)
    REFERENCES cloud_nodes (account_id, project_id, node_id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS cloud_node_object_links (
  account_id VARCHAR(191) NOT NULL,
  project_id VARCHAR(191) NOT NULL,
  node_id VARCHAR(191) NOT NULL,
  object_order INT NOT NULL,
  object_id VARCHAR(191) NOT NULL,
  PRIMARY KEY (account_id, project_id, node_id, object_order),
  INDEX idx_cloud_node_object_links_object (account_id, project_id, object_id),
  CONSTRAINT fk_cloud_node_object_links_node
    FOREIGN KEY (account_id, project_id, node_id)
    REFERENCES cloud_nodes (account_id, project_id, node_id)
    ON DELETE CASCADE,
  CONSTRAINT fk_cloud_node_object_links_object
    FOREIGN KEY (account_id, project_id, object_id)
    REFERENCES cloud_objects (account_id, project_id, object_id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS cloud_temporary_drawer (
  account_id VARCHAR(191) NOT NULL,
  project_id VARCHAR(191) NOT NULL,
  drawer_item_id VARCHAR(191) NOT NULL,
  episode_id VARCHAR(191) NOT NULL,
  source_node_id VARCHAR(191) NULL,
  label TEXT NOT NULL,
  note MEDIUMTEXT NOT NULL,
  created_at VARCHAR(40) NOT NULL,
  updated_at VARCHAR(40) NOT NULL,
  PRIMARY KEY (account_id, project_id, drawer_item_id),
  INDEX idx_cloud_temporary_drawer_episode (account_id, project_id, episode_id),
  CONSTRAINT fk_cloud_temporary_drawer_project
    FOREIGN KEY (account_id, project_id)
    REFERENCES cloud_projects (account_id, project_id)
    ON DELETE CASCADE,
  CONSTRAINT fk_cloud_temporary_drawer_episode
    FOREIGN KEY (account_id, project_id, episode_id)
    REFERENCES cloud_episodes (account_id, project_id, episode_id)
    ON DELETE CASCADE,
  CONSTRAINT fk_cloud_temporary_drawer_source_node
    FOREIGN KEY (account_id, project_id, source_node_id)
    REFERENCES cloud_nodes (account_id, project_id, node_id)
    ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
