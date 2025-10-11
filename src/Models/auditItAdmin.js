module.exports = (sequelize, DataTypes) => {
  const AuditItAdmin = sequelize.define('AuditItAdmin', {
    id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
    userId: { type: DataTypes.STRING(64), allowNull: false },
    action: { type: DataTypes.STRING(64), allowNull: false },
    entityType: { type: DataTypes.STRING(32), allowNull: false },
    entityId: { type: DataTypes.STRING(64), allowNull: false },
    metadata: { type: DataTypes.JSON, allowNull: true },
    createdAt: { type: DataTypes.DATE(3), allowNull: false, defaultValue: DataTypes.NOW },
  }, {
    tableName: 'audit_it_admin',
    timestamps: false,
    indexes: [
      { fields: ['userId'] },
      { fields: ['action'] },
      { fields: ['createdAt'] },
    ],
  });

  return AuditItAdmin;
};
