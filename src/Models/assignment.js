module.exports = (sequelize, DataTypes) => {
  const Assignment = sequelize.define('Assignment', {
    id: { type: DataTypes.CHAR(36), primaryKey: true, allowNull: false },
    assetId: { type: DataTypes.CHAR(36), allowNull: false },
    employeeId: { type: DataTypes.STRING(64), allowNull: false },
    assignedAt: { type: DataTypes.DATE(3), allowNull: false, defaultValue: DataTypes.NOW },
    assignedBy: { type: DataTypes.STRING(64), allowNull: false },
    returnedAt: { type: DataTypes.DATE(3), allowNull: true },
    returnedBy: { type: DataTypes.STRING(64), allowNull: true },
    status: { type: DataTypes.ENUM('active', 'returned', 'retired'), allowNull: false, defaultValue: 'active' },
    notes: { type: DataTypes.TEXT, allowNull: true },
    conditionOnAssign: { type: DataTypes.STRING(255), allowNull: true },
    conditionOnReturn: { type: DataTypes.STRING(255), allowNull: true },
    retired: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    retireReason: { type: DataTypes.STRING(255), allowNull: true },
    retiredBy: { type: DataTypes.STRING(64), allowNull: true },
    createdAt: { type: DataTypes.DATE(3), allowNull: false, defaultValue: DataTypes.NOW },
    updatedAt: { type: DataTypes.DATE(3), allowNull: false, defaultValue: DataTypes.NOW },
  }, {
    tableName: 'assignments',
    timestamps: true,
    createdAt: 'createdAt',
    updatedAt: 'updatedAt',
    indexes: [
      { fields: ['assetId', 'status'] },
      { fields: ['employeeId', 'status'] },
      { fields: ['assignedAt'] },
      { fields: ['returnedAt'] },
    ],
  });

  return Assignment;
};
