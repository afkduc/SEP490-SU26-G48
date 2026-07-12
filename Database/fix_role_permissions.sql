/* ============================================================
   Safe fix for role_permissions foreign key mismatch
   Run this AFTER the previous failed script
   ============================================================ */

BEGIN TRY
  BEGIN TRANSACTION;

  -- 1. Drop role_permissions if it exists (it may be partially created)
  IF EXISTS (SELECT * FROM sys.tables WHERE name = 'role_permissions' AND schema_id = SCHEMA_ID('dbo'))
  BEGIN
    DROP TABLE [dbo].[role_permissions];
    PRINT 'Dropped existing role_permissions table';
  END

  -- 2. Check the data type of permissions.id dynamically
  DECLARE @permissions_id_type NVARCHAR(50);
  DECLARE @sql NVARCHAR(MAX);

  SELECT @permissions_id_type = DATA_TYPE 
  FROM INFORMATION_SCHEMA.COLUMNS 
  WHERE TABLE_SCHEMA = 'dbo' 
    AND TABLE_NAME = 'permissions' 
    AND COLUMN_NAME = 'id';

  PRINT 'Detected permissions.id type: ' + @permissions_id_type;

  -- 3. Create role_permissions with matching data type
  SET @sql = N'
  CREATE TABLE [dbo].[role_permissions] (
    [id] ' + @permissions_id_type + N' IDENTITY(1,1) PRIMARY KEY,
    [role_id] BIGINT NOT NULL FOREIGN KEY REFERENCES [dbo].[roles]([id]) ON DELETE CASCADE,
    [permission_id] ' + @permissions_id_type + N' NOT NULL FOREIGN KEY REFERENCES [dbo].[permissions]([id]) ON DELETE CASCADE,
    CONSTRAINT [UQ_role_permission] UNIQUE ([role_id], [permission_id])
  );

  CREATE NONCLUSTERED INDEX [IX_role_permissions_role_id] ON [dbo].[role_permissions] ([role_id]);
  ';

  EXEC sp_executesql @sql;
  PRINT 'Created role_permissions table with matching data type';

  -- 4. Grant permissions to 'admin' role (only if not already granted)
  IF EXISTS (SELECT * FROM [dbo].[roles] WHERE [role_name] = 'admin')
  BEGIN
    INSERT INTO [dbo].[role_permissions] ([role_id], [permission_id])
    SELECT 
      r.[id],
      p.[id]
    FROM [dbo].[roles] r
    CROSS JOIN [dbo].[permissions] p
    WHERE r.[role_name] = 'admin'
      AND NOT EXISTS (
        SELECT 1 FROM [dbo].[role_permissions] rp 
        WHERE rp.[role_id] = r.[id] AND rp.[permission_id] = p.[id]
      );
    
    PRINT 'Granted permissions to admin role';
  END

  -- 5. Grant read-only permissions to 'general_director' role
  IF EXISTS (SELECT * FROM [dbo].[roles] WHERE [role_name] = 'general_director')
  BEGIN
    INSERT INTO [dbo].[role_permissions] ([role_id], [permission_id])
    SELECT 
      r.[id],
      p.[id]
    FROM [dbo].[roles] r
    CROSS JOIN [dbo].[permissions] p
    WHERE r.[role_name] = 'general_director'
      AND p.[action] IN ('read', 'change_password')
      AND p.[module] IN ('admin', 'profile')
      AND NOT EXISTS (
        SELECT 1 FROM [dbo].[role_permissions] rp 
        WHERE rp.[role_id] = r.[id] AND rp.[permission_id] = p.[id]
      );
    
    PRINT 'Granted permissions to general_director role';
  END

  COMMIT TRANSACTION;
  PRINT 'SUCCESS: role_permissions table created and seeded';
  
  -- 6. Summary
  SELECT 'permissions' AS table_name, COUNT(*) AS row_count FROM [dbo].[permissions]
  UNION ALL
  SELECT 'role_permissions', COUNT(*) FROM [dbo].[role_permissions];

END TRY
BEGIN CATCH
  IF @@TRANCOUNT > 0
    ROLLBACK TRANSACTION;
  
  PRINT 'ERROR: ' + ERROR_MESSAGE();
  THROW;
END CATCH
