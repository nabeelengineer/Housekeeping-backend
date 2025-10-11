module.exports = (sequelize, DataTypes) => {
  const ProductComment = sequelize.define('ProductComment', {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    product_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    commenter_id: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    text: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  }, {
    tableName: 'product_comments',
    timestamps: false,
    indexes: [
      { fields: ['product_id'] },
      { fields: ['commenter_id'] },
    ],
  });

  return ProductComment;
};
