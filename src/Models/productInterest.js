module.exports = (sequelize, DataTypes) => {
  const ProductInterest = sequelize.define('ProductInterest', {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    product_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    buyer_id: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  }, {
    tableName: 'product_interests',
    timestamps: false,
    indexes: [
      { unique: true, fields: ['product_id', 'buyer_id'] },
    ],
  });

  return ProductInterest;
};
