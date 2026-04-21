CREATE TABLE IF NOT EXISTS cloud_projects (
  account_id VARCHAR(191) NOT NULL,
  project_id VARCHAR(191) NOT NULL,
  linkage_json JSON NOT NULL,
  snapshot_json JSON NOT NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (account_id, project_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
