CREATE DATABASE vission_assist;

USE vission_assist;

CREATE TABLE Facilities (
    id VARCHAR(36) PRIMARY KEY,
    `name` VARCHAR(20) NOT NULL,
    `address` VARCHAR(30),
    representative_name VARCHAR(20),
    emergency_contact VARCHAR(11)
);

CREATE TABLE Admins (
    id VARCHAR(36) PRIMARY KEY,
    facility_id VARCHAR(36),
    login_id VARCHAR(10)NOT NULL,
    password_hash VARCHAR(255),
    `name` VARCHAR(10) NOT NULL,
    FOREIGN KEY (facility_id)
    REFERENCES Facilities(id)
);

CREATE TABLE Patients (
    id VARCHAR(36) PRIMARY KEY,
    facility_id VARCHAR(36),
    `name` VARCHAR(10) NOT NULL,
    age INT,
    emergency_note VARCHAR(100),
    login_id VARCHAR(10)NOT NULL,
    password_hash VARCHAR(255),
    FOREIGN KEY (facility_id)
    REFERENCES Facilities(id)
);

CREATE TABLE Devices (
    id VARCHAR(36) PRIMARY KEY,
    patient_id VARCHAR(36),
    device_mac_address VARCHAR(17),
    battery_status CHAR(3),
    last_heartbeat DATETIME,
    FOREIGN KEY (patient_id)
    REFERENCES Patients(id)
);

CREATE TABLE WalkingLogs (
    id VARCHAR(36) PRIMARY KEY,
    patient_id VARCHAR(36),
    start_time DATETIME,
    end_time DATETIME,
    FOREIGN KEY (patient_id)
    REFERENCES Patients(id)
);

CREATE TABLE GPSData (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    log_id VARCHAR(36),
    latitude DECIMAL(7,4),
    longitude DECIMAL(7,4),
    `timestamp` DATETIME,
    FOREIGN KEY (log_id)
    REFERENCES WalkingLogs(id)
);