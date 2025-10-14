module.exports = (sequelize, DataTypes) => {
  const Vehicle = sequelize.define('Vehicle', {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    type: {
      type: DataTypes.ENUM('car', 'scooter', 'bike'),
      allowNull: false,
    },
    wheelers: {
      // '2' for two-wheelers, '4' for four-wheelers
      type: DataTypes.ENUM('2', '4'),
      allowNull: true,
    },
    plate: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    image_url: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    chassis_no: {
      type: DataTypes.STRING,
      allowNull: true,
      unique: false,
    },
    // Insurance document
    insurance_image_url: { type: DataTypes.STRING, allowNull: true },
    insurance_valid_from: { type: DataTypes.DATEONLY, allowNull: true },
    insurance_valid_to: { type: DataTypes.DATEONLY, allowNull: true },
    // RC document
    rc_image_url: { type: DataTypes.STRING, allowNull: true },
    rc_valid_from: { type: DataTypes.DATEONLY, allowNull: true },
    rc_valid_to: { type: DataTypes.DATEONLY, allowNull: true },
    // Pollution document
    pollution_image_url: { type: DataTypes.STRING, allowNull: true },
    pollution_valid_from: { type: DataTypes.DATEONLY, allowNull: true },
    pollution_valid_to: { type: DataTypes.DATEONLY, allowNull: true },
    // Generic vehicle paper image (if any other docs)
    paper_image_url: { type: DataTypes.STRING, allowNull: true },
    status: {
      type: DataTypes.ENUM('available', 'rented', 'maintenance'),
      allowNull: false,
      defaultValue: 'available',
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    updated_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  }, {
    tableName: 'vehicles',
    timestamps: false,
    indexes: [
      { unique: true, fields: ['plate'] },
      { fields: ['status'] },
      { fields: ['type'] },
    ],
  });

  return Vehicle;
};

