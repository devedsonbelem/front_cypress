/// <reference types="cypress" />

describe('Given the Users api', () => {
  context('When I send GET /users', () => {
    it('Then it should return a list with all registered users', () => {
      cy.request({
        method: 'GET',
        url: '/users'
      })
        .should((response) => {
          expect(response.status).to.eq(200)
           Cypress._.each(response.body.users, (users) => {
            expect(users.email).to.not.be.null
            expect(users).to.have.all.keys('nome', 'email','id')
          })
        });
    });
  });

  context('When I send GET /users passing id query param', () => {
    it('Then it should return only the filtered user', () => {
      cy.request({
        method: 'GET',
        url: '/users',
        qs: {
          id: '1001'
        }
      })
        .should((response) => {
          expect(response.status).to.eq(200)
          expect(response.body.users[0].name).to.eq("belem")
        });
    });
  });
});