module.exports = (sequelize, DataTypes) => {
  const Notification = sequelize.define(
    'Notification',
    {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
      recipient_id: { type: DataTypes.STRING, allowNull: false },
      type: { type: DataTypes.STRING, allowNull: false },
      message: { type: DataTypes.STRING(500), allowNull: false },
      meta: { type: DataTypes.JSON, allowNull: true },
      read: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    },
    {
      tableName: 'notifications',
      timestamps: false,
      indexes: [
        { fields: ['recipient_id'] },
        { fields: ['read'] },
        { fields: ['type'] },
      ],
    }
  );

  return Notification;
};
