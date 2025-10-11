module.exports = (sequelize, DataTypes) => {
  const ProductFlag = sequelize.define('ProductFlag', {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    product_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    reporter_id: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    reason: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    status: {
      // open -> received -> kept | removed
      type: DataTypes.ENUM('open', 'received', 'kept', 'removed'),
      allowNull: false,
      defaultValue: 'open',
    },
    admin_notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    resolved_by: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    resolved_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  }, {
    tableName: 'product_flags',
    timestamps: false,
    indexes: [
      { fields: ['product_id'] },
      { fields: ['reporter_id'] },
      { fields: ['status'] },
    ],
  });

  return ProductFlag;
};
