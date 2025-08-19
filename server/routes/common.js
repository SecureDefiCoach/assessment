const express = require('express');
var app = express();

var commonController = require('../controllers/common.controller');

var router = express.Router();

router.route('/state')
  .get(commonController.getStateList)
  .post(commonController.addState)

router.route('/cities')
  .get(commonController.getAllCities)
  .post(commonController.addCity)

router.get('/cities/:state_id', commonController.getCityList)

router.delete('/city/:cityId', commonController.removeCity)

router.get('/checkemail-availability/email/:email', commonController.checkemailAvailability)

module.exports = router;