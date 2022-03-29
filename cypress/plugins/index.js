/// <reference types="cypress" />

const faker = require('faker');

/**
 * @type {Cypress.PluginConfig}
 */

module.exports = (on, config) => {
  on("task", {
    freshUser() {
      users = {
        id : '1004',
        name: 'omar',
        email: 'omar@gmail.com',
      };
      return users;
    }
  })
  return config
}
