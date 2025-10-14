const sequelize = require('../config/db');
const { DataTypes } = require('sequelize');

const Employee = require('./employee')(sequelize, DataTypes);
const Department = require('./department')(sequelize, DataTypes);
const Category = require('./category')(sequelize, DataTypes);
const Request = require('./request')(sequelize, DataTypes);
const RequestDepartment = require('./requestDepartment')(sequelize, DataTypes);
const RequestCategory = require('./requestCategory')(sequelize, DataTypes);
// IT Assets module
const Asset = require('./asset')(sequelize, DataTypes);
const Assignment = require('./assignment')(sequelize, DataTypes);
const AuditItAdmin = require('./auditItAdmin')(sequelize, DataTypes);
const AuditAdmin = require('./auditAdmin')(sequelize, DataTypes);

// Buy/Sell models
const Product = require('./product')(sequelize, DataTypes);
const ProductImage = require('./productImage')(sequelize, DataTypes);
const ProductInterest = require('./productInterest')(sequelize, DataTypes);
const ProductFlag = require('./productFlag')(sequelize, DataTypes);
const ProductComment = require('./productComment')(sequelize, DataTypes);
const Notification = require('./notification')(sequelize, DataTypes);

// Vehicle Rental models
const Vehicle = require('./vehicle')(sequelize, DataTypes);
const RentalLog = require('./rentalLog')(sequelize, DataTypes);
const RentalOdometerRead = require('./rentalOdometerRead')(sequelize, DataTypes);

// Employee ↔ Department (One-to-Many)
Department.hasMany(Employee, { foreignKey: 'department_id' });
Employee.belongsTo(Department, { foreignKey: 'department_id', as: 'department' });

// Employee ↔ Request (One-to-Many)
Employee.hasMany(Request, { foreignKey: 'employee_id', as: 'requests' });
Request.belongsTo(Employee, { foreignKey: 'employee_id', as: 'requester' });

Employee.hasMany(Request, { foreignKey: 'assigned_to', as: 'assignedRequests' });
Request.belongsTo(Employee, { foreignKey: 'assigned_to', as: 'assignedStaff' });

// Request ↔ Department (Many-to-Many)
Request.belongsToMany(Department, { through: RequestDepartment, foreignKey: 'request_id', otherKey: 'dept_id', as: 'departments' });
Department.belongsToMany(Request, { through: RequestDepartment, foreignKey: 'dept_id', otherKey: 'request_id', as: 'requests' });

// Request ↔ Category (Many-to-Many)
Request.belongsToMany(Category, { through: RequestCategory, foreignKey: 'request_id', otherKey: 'category_id', as: 'categories' });
Category.belongsToMany(Request, { through: RequestCategory, foreignKey: 'category_id', otherKey: 'request_id', as: 'requests' });

// =========================
// Buy/Sell Associations
// =========================
// Product ↔ Employee (seller)
Employee.hasMany(Product, { foreignKey: 'seller_id', as: 'productsForSale' });
Product.belongsTo(Employee, { foreignKey: 'seller_id', as: 'seller' });

// Product ↔ ProductImage
Product.hasMany(ProductImage, { foreignKey: 'product_id', as: 'images', onDelete: 'CASCADE' });
ProductImage.belongsTo(Product, { foreignKey: 'product_id', as: 'product' });

// Product ↔ ProductInterest (buyer)
Product.hasMany(ProductInterest, { foreignKey: 'product_id', as: 'interests', onDelete: 'CASCADE' });
ProductInterest.belongsTo(Product, { foreignKey: 'product_id', as: 'product' });
Employee.hasMany(ProductInterest, { foreignKey: 'buyer_id', as: 'buyerInterests' });
ProductInterest.belongsTo(Employee, { foreignKey: 'buyer_id', as: 'buyer' });

// Product ↔ ProductFlag (reporter)
Product.hasMany(ProductFlag, { foreignKey: 'product_id', as: 'flags', onDelete: 'CASCADE' });
ProductFlag.belongsTo(Product, { foreignKey: 'product_id', as: 'product' });
Employee.hasMany(ProductFlag, { foreignKey: 'reporter_id', as: 'reportedFlags' });
ProductFlag.belongsTo(Employee, { foreignKey: 'reporter_id', as: 'reporter' });

// Product ↔ ProductComment (commenter)
Product.hasMany(ProductComment, { foreignKey: 'product_id', as: 'comments', onDelete: 'CASCADE' });
ProductComment.belongsTo(Product, { foreignKey: 'product_id', as: 'product' });
Employee.hasMany(ProductComment, { foreignKey: 'commenter_id', as: 'commentsMade' });
ProductComment.belongsTo(Employee, { foreignKey: 'commenter_id', as: 'commenter' });

// Notifications
Employee.hasMany(Notification, { foreignKey: 'recipient_id', as: 'notifications' });
Notification.belongsTo(Employee, { foreignKey: 'recipient_id', as: 'recipient' });

// =========================
// Vehicle Rental Associations
// =========================
Vehicle.hasMany(RentalLog, { foreignKey: 'vehicle_id', as: 'logs', onDelete: 'CASCADE' });
RentalLog.belongsTo(Vehicle, { foreignKey: 'vehicle_id', as: 'vehicle' });

// Odometer: 1:1 with a rental log; also link to vehicle for reporting
RentalLog.hasOne(RentalOdometerRead, { foreignKey: 'rental_id', as: 'odometer', onDelete: 'CASCADE' });
RentalOdometerRead.belongsTo(RentalLog, { foreignKey: 'rental_id', as: 'rental' });
Vehicle.hasMany(RentalOdometerRead, { foreignKey: 'vehicle_id', as: 'odometerReads', onDelete: 'CASCADE' });
RentalOdometerRead.belongsTo(Vehicle, { foreignKey: 'vehicle_id', as: 'vehicleRef' });

Employee.hasMany(RentalLog, { foreignKey: 'renter_id', as: 'rentalLogs' });
RentalLog.belongsTo(Employee, { foreignKey: 'renter_id', as: 'renter' });

// =========================
// IT Assets Associations
// =========================
Asset.hasMany(Assignment, { foreignKey: 'assetId', as: 'assignments' });
Assignment.belongsTo(Asset, { foreignKey: 'assetId', as: 'asset' });
Employee.hasMany(Assignment, { foreignKey: 'employeeId', as: 'assetAssignments' });
Assignment.belongsTo(Employee, { foreignKey: 'employeeId', as: 'employee' });
// Track who performed assignment/return (not strict FKs at model level, but queryable)

module.exports = {
  sequelize,
  Employee,
  Department,
  Category,
  Request,
  RequestDepartment,
  RequestCategory,
  // Buy/Sell exports
  Product,
  ProductImage,
  ProductInterest,
  ProductFlag,
  ProductComment,
  Notification,
  // Vehicle rental exports
  Vehicle,
  RentalLog,
  RentalOdometerRead,
  // IT assets exports
  Asset,
  Assignment,
  AuditItAdmin,
  AuditAdmin,
};
