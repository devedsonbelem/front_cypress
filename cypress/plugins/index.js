/// <reference types="cypress" />

const faker = require('faker');

/**
 * @type {Cypress.PluginConfig}
 */

module.exports = (on, config) => {
  on("task", {
    freshUser() {
      users = {
        id : '1006',
        name: 'luciana',
        email: 'luciana@gmail.com',
        password:"123456",
        latitude:1010,
        longitude:2020
      };
      return users;
    }
  })
  return config
}
