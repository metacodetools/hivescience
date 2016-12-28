import _ from "underscore"
import { toCamelCase } from "./helpers"

export default class DB {
  constructor(sqlitePlugin) {
    this.sqlitePlugin = sqlitePlugin;
  }

  initialize() {
    this.connection = this.sqlitePlugin.openDatabase({
      name: "buzz_buzz",
      location: "default"
    });
  }

  createTables() {
    this.createProfilesTable();
    this.createSurveysTable();
  }

  profileColumns() {
    return [
      // Note the specific ordering, this is critical for the sql
      // queries to work.
      ["email", "VARCHAR(100)"],
      ["full_name", "VARCHAR(100)"],
      ["zip_code", "VARCHAR(20)"],
      ["number_of_colonies", "INTEGER"],
      ["race_of_bees", "TEXT"],
      ["monitor_varroa_mites", "VARCHAR(1)"],
      ["monitor_varroa_mites_count", "INTEGER"],
      ["monitor_methods", "VARCHAR(255)"],
      ["treatment_methods", "VARCHAR(255)"],
      ["last_treatment_date", "TEXT"],
      ["lost_colonies_over_winter", "VARCHAR(1)"]
    ];
  };

  extractProfileValuesFromAttributes(attributes) {
    const columnNames = this.profileColumns()
      .map((column_pair) => toCamelCase(column_pair[0]));
    return columnNames.map((column_name) => attributes[column_name]);
  }

  profileColumnNames() {
    return this.profileColumns()
      .map((column_pair) => column_pair[0]).join(", ");
  }

  profileUpdatePreparedStatement() {
    let statement = "";
    _.times(this.profileColumns().length, () => statement += "?, ");
    return statement.slice(0, -2);
  }

  profileColumnsForInsert() {
    let joinedColumns = this.profileColumns().reduce(
      (memo, elem) => memo.concat(elem.join(" ") + ", "),
      "");
    return joinedColumns.slice(0, -2);
  }

  surveyColumns() {
    return [
      ["queen_right", "VARCHAR(1)"],
      ["queen_drone_laying", "VARCHAR(1)"],
      ["diseases", "TEXT"],
      ["honey_supers_on", "VARCHAR(1)"],
      ["honey_supers_removed", "VARCHAR(1)"],
      ["feeding_supplementary_sugar", "VARCHAR(1)"],
      ["honey_from_sealed_cells", "VARCHAR(1)"],
      ["honey_from_brood", "VARCHAR(1)"],
      ["split_or_combine", "VARCHAR(1)"],
      ["sample_tube_code", "INTEGER"]
    ]
  }

  extractSurveyValuesFromAttributes(attributes) {
    const columnNames = this.surveyColumns()
      .map((column_pair) => toCamelCase(column_pair[0]));
    return columnNames.map((column_name) => attributes[column_name]);
  }

  surveyColumnNames() {
    return this.surveyColumns()
      .map((column_pair) => column_pair[0]).join(", ");
  }

  surveyUpdatePreparedStatement() {
    let statement = "";
    _.times(this.surveyColumns().length, () => statement += "?, ");
    return statement.slice(0, -2);
  }

  surveyColumnsForInsert() {
    let joinedColumns = this.surveyColumns().reduce(
      (memo, elem) => memo.concat(elem.join(" ") + ", "),
      "");
    return joinedColumns.slice(0, -2);
  }

  createProfilesTable() {
    const sqlStatement = `
      CREATE TABLE IF NOT EXISTS profiles (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ${this.profileColumnsForInsert()}
      );`;
    this.executeSql(sqlStatement.replace(/\s+/g, " "));
  }

  createSurveysTable() {
    const sqlStatement = `
      CREATE TABLE IF NOT EXISTS surveys (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ${this.surveyColumnsForInsert()}
      );`;
    this.executeSql(sqlStatement.replace(/\s+/g, " "));
  }

  createProfile(attributes) {
    const sqlStatement = `
      INSERT INTO profiles ( ${this.profileColumnNames()} )
      VALUES (${this.profileUpdatePreparedStatement()});`;
    const values = this.extractProfileValuesFromAttributes(attributes);
    this.executeSql(sqlStatement.replace(/\s+/g, " "), values);
  }

  createSurvey(attributes) {
    const sqlStatement = `
      INSERT INTO surveys ( ${this.surveyColumnNames()} )
      VALUES (${this.surveyUpdatePreparedStatement()});`;
    const values = this.extractSurveyValuesFromAttributes(attributes);
    this.executeSql(sqlStatement.replace(/\s+/g, " "), values);
  }

  executeSql(sqlStatement, sqlVariables = []) {
    let action = sqlStatement.split("(")[0].trim();
    this.connection.executeSql(
      sqlStatement,
      sqlVariables,
      () => console.log(`${action} successful`),
      (error) => console.log(`${action} failed`, error)
    );
  }
}