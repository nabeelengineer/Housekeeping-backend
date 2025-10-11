module.exports = (sequelize, DataTypes) => {
  const Asset = sequelize.define('Asset', {
    id: {
      type: DataTypes.CHAR(36),
      primaryKey: true,
      allowNull: false,
    },
    assetId: {
      type: DataTypes.STRING(64),
      allowNull: false,
      unique: true,
    },
    serialNumber: {
      type: DataTypes.STRING(128),
      allowNull: false,
      unique: true,
    },
    assetType: {
      type: DataTypes.ENUM('laptop', 'mouse', 'keyboard', 'stand', 'other'),
      allowNull: false,
      defaultValue: 'laptop',
    },
    typeDetail: { type: DataTypes.STRING(64), allowNull: true },
    brand: { type: DataTypes.STRING(64), allowNull: true },
    model: { type: DataTypes.STRING(128), allowNull: true },
    cpu: { type: DataTypes.STRING(128), allowNull: true },
    ram: { type: DataTypes.STRING(64), allowNull: true },
    storage: { type: DataTypes.STRING(128), allowNull: true },
    os: { type: DataTypes.STRING(128), allowNull: true },
    gpu: { type: DataTypes.STRING(128), allowNull: true },
    purchaseDate: { type: DataTypes.DATEONLY, allowNull: true },
    warrantyExpiry: { type: DataTypes.DATEONLY, allowNull: true },
    location: { type: DataTypes.STRING(128), allowNull: true },
    status: {
      type: DataTypes.ENUM('active', 'assigned', 'repair', 'retired'),
      allowNull: false,
      defaultValue: 'active',
    },
    createdAt: { type: DataTypes.DATE(3), allowNull: false, defaultValue: DataTypes.NOW },
    updatedAt: { type: DataTypes.DATE(3), allowNull: false, defaultValue: DataTypes.NOW },
  }, {
    tableName: 'assets',
    timestamps: true,
    updatedAt: 'updatedAt',
    indexes: [
      { fields: ['assetType'] },
      { fields: ['status'] },
    ],
  });

  return Asset;
};
