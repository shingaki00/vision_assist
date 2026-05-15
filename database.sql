CRREATE DATABASE vission_asset;

USE vission_asset;

CREATE TABLE Facilities (
    id BINARY(16) PRIMARY KEY,
    name VARCHAR(20) NOT NULL,
    address VARCHAR(30),
    representative_name VARCHAR(20),
    emergency_contact VARCHAR(11)
);

CREATE TABLE Admins (
    id BINARY(16) PRIMARY KEY,
    facility_id BINARY(16) FOREIGN KEY,
    login_id VARCHAR(10)NOT NULL,
    password_hash VARCHAR(255),
    name VARCHAR(10) NOT NULL
);

CREATE TABLE Patients (
    id BINARY(16) PRIMARY KEY,
    facility_id BINARY(16) FOREIGN KEY,
    name VARCHAR(10) NOT NULL,
    age INT(3),
    emergency_note VARCHAR(100),
    login_id VARCHAR(10)NOT NULL,
    password_hash VARCHAR(255)
);

CREATE TABLE Devices (
    id BINARY(16) PRIMARY KEY,
    patient_id BINARY(16) FOREIGN KEY,
    device_mac_address VARCHAR(17),
    battery_status CHAR(3),
    last_hertbeat DATETIME
);

CREATE TABLE WalkingLogs (
    id BINARY(16) PRIMARY KEY,
    patient_id BINARY(16) FOREIGN KEY,
    start_time DATETIME,
    end_time DATETIME
);

CREATE TABLE CPSData (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    log_id BINARY(16) FOREIGN KEY,
    latitude DECIMAL(7,4),
    longitude DECIMAL(7,4),
    timestamp DATETIME
);