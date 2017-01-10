import _ from "underscore";
import $ from "jquery";
import Handlebars from "handlebars";
import DB from "./db";
import {formatAttributes} from "./helpers";
import ProfileRepository from "./repositories/profile_repository";
import SurveyRepository from "./repositories/survey_repository";
import GeoPlatformGateway from "./geo_platform/geo_platform_gateway";
import AttributesFormatter from "./geo_platform/attributes_formatter";
import CameraService from "./services/camera_service";
import FileService from "./services/file_service";
import "babel-core/register";
import "babel-polyfill";

let db;
let body;

let profileFormTemplate;
let surveyFormTemplate;
let dataViewTemplate;
let welcomeTemplate;
let reportsTemplate;

let profileAttributes = {};
let surveyAttributes = {};
let miteCountPhotoUri;

let profileRepository;
let surveyRepository;

let cameraService;
let fileService;

let app = {
  initialize: function () {
    profileFormTemplate = Handlebars.compile($("#profile-form-template").html());
    surveyFormTemplate = Handlebars.compile($("#survey-form-template").html());
    dataViewTemplate = Handlebars.compile($("#data-view-template").html());
    welcomeTemplate = Handlebars.compile($("#welcome-template").html());
    reportsTemplate = Handlebars.compile($("#reports-template").html());
    document.addEventListener("deviceready", this.onDeviceReady.bind(this), false);
  },

  onDeviceReady: async function () {
    body = $("body");
    cameraService = new CameraService(navigator.camera);
    fileService = new FileService(window, FileReader, Blob);
    await this._setupDatabase();
    if (await this._profileExists()) {
      $("#main-container").html(welcomeTemplate());
      $(".create-report").on("click", (event) => {
        event.preventDefault();
        this.renderSurveyForm();
      });
    } else {
      this.renderProfileForm();
    }
  },

  renderProfileForm: function () {
    $("#main-container").html(profileFormTemplate());
    window.scrollTo(0, 0);

    $(".profile-form-back-button").on("click", (event) => {
      const pageNumber = parseInt($(event.target).data("next-page"), 10);
      $(`#profile-form-page-${pageNumber + 1}`).hide();
      $(`#profile-form-page-${pageNumber}`).show();
      window.scrollTo(0, 0);
    });

    $(".profile-form-next-button").on("click", (event) => {
      const pageNumber = parseInt($(event.target).data("next-page"), 10);
      $(`#profile-form-page-${pageNumber - 1}`).hide();
      $(`#profile-form-page-${pageNumber}`).show();
      window.scrollTo(0, 0);
    });

    this._setupOption("#other-race-of-bees", "#input-race");
    this._setupOption("#other-monitor-method", "#input-method");
    this._setupOption("#other-treatment-method", "#input-treatment");

    this._setupRadioButtonsAria();

    const form = $("#profile-form");
    form.on("submit", (event) => {
      event.preventDefault();
      profileAttributes = formatAttributes(form.serializeArray());
      profileRepository.createRecord(profileAttributes);
      $("#profile-form-template").hide();
      this.renderSurveyForm();
    });
  },

  renderSurveyForm: function () {
    body.removeClass("white-background");
    body.addClass("gray-background");
    $("#main-container").html(surveyFormTemplate());
    window.scrollTo(0, 0);

    this._setupOption("#other-disease", "#input-disease");

    this._setupRadioButtonsAria();

    this._setupAddMitesPhotoButton();

    $("#number-of-mites").on("keyup", (event) => {
      const numberOfMitesTotal = parseFloat(event.target.value, 10);
      const numberOfMitesPer100 = Math.round((numberOfMitesTotal / 3.0) * 100.0) / 100.0;
      if (isNaN(numberOfMitesPer100)) {
        $("#mites-per-bees-calc").text("");
        $("#mites-per-bees-calc").hide();
      } else {
        $("#mites-per-bees-calc").text(`${numberOfMitesPer100} mites per 100 bees`);
        $("#mites-per-bees-calc").show();
      }
    });

    const form = $("#survey-form");
    form.on("submit", async (event) => {
      event.preventDefault();
      surveyAttributes = formatAttributes(form.serializeArray());
      const baseAttributes = {createdOn: (new Date()).toLocaleDateString()};
      _.extend(surveyAttributes, baseAttributes, miteCountPhotoUri);
      await surveyRepository.createRecord(surveyAttributes);

      const surveys = await surveyRepository.findAll();
      const profiles = await profileRepository.findAll();
      await this._syncToGeoPlatform(_.last(profiles), _.last(surveys));

      $("#survey-form-template").hide();
      this.renderReportsView(surveys);
    });
  },

  renderReportsView: function (surveys) {
    body.removeClass("gray-background");
    body.addClass("white-background");
    $("#main-container").html(reportsTemplate({surveys: surveys}));
    $(".create-report").on("click", (event) => {
      event.preventDefault();
      this.renderSurveyForm();
    });
    window.scrollTo(0, 0);
  },

  // "private" methods

  _setupDatabase: async function () {
    db = new DB(window.sqlitePlugin);
    db.initialize();
    await this._setupRepositories(db);
  },

  _setupRepositories: async function (db) {
    profileRepository = new ProfileRepository(db);
    surveyRepository = new SurveyRepository(db);
    await profileRepository.createTable();
    await surveyRepository.createTable();
  },

  _profileExists: async function () {
    const profiles = await profileRepository.findAll();
    return profiles.length > 0;
  },

  _syncToGeoPlatform: async function (profile, survey) {
    const formatter = new AttributesFormatter(profile, survey);
    const photo = await fileService.getBlob(survey["mite_count_photo_uri"]);
    const geoPlatform = new GeoPlatformGateway(formatter.execute(), photo);
    await geoPlatform.sync();
  },

  _setupOption: function (parentId, childId) {
    $(parentId).on("click", () => {
      if ($(parentId).is(":checked")) {
        $(childId).show();
      } else {
        $(`${childId} > input`).val("");
        $(childId).hide();
      }
    });
  },

  _setupRadioButtonsAria: function () {
    $("input[type=radio]").on("change", (event) => {
      const label = $(`label[for=${event.target.id}]`);
      const siblingLabels = label.siblings("label");
      const checked = event.target.checked;
      siblingLabels.attr("aria-checked", !checked);
      label.attr("aria-checked", checked);
    });
  },

  _setupAddMitesPhotoButton: function () {
    $("#add-mites-photo").on("click", async(event) => {
      event.preventDefault();
      const imageUri = await cameraService.getImageUri();
      let fileEntry = await fileService.getFile(imageUri);
      let copiedFileUri = await fileService.copyFile(fileEntry, cordova.file.dataDirectory);
      miteCountPhotoUri = {miteCountPhotoUri: copiedFileUri};
    });
  }
};

app.initialize();