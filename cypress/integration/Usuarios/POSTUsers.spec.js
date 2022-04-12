/// <reference types="cypress" />

let fakeUser;

describe('Given the Users api', () => {
  beforeEach(() => {
    cy.task('freshUser').then((users) => {
      fakeUser = users;
      cy.log(JSON.stringify(fakeUser))
    });
  });

  context('When I send POST /users', () => {
    it('Then it should create a new user', () => {
      cy.request({
        method: 'POST',
        url: '/UsersApi/users/',
        body: fakeUser
      })
        .should((response) => {
          expect(response.status).eq(201)
          expect(response.body.msg).eq("users adicionado com sucesso")
        });
    });
  });
});