(function () {
  'use strict';

  var firebaseConfig = {
    apiKey:            'AIzaSyBSvgS79L0UqyMAeokvy_4m9rqK84ZYHP8',
    authDomain:        'marcus-apps.firebaseapp.com',
    projectId:         'marcus-apps',
    storageBucket:     'marcus-apps.firebasestorage.app',
    messagingSenderId: '289338304288',
    appId:             '1:289338304288:web:9b5b8ebf6c68bd3ba55945',
  };

  window.MarcusApps = window.MarcusApps || {};

  if (typeof firebase === 'undefined') {
    MarcusApps.offline = true;
    return;
  }

  firebase.initializeApp(firebaseConfig);
  MarcusApps.db   = firebase.firestore();
  MarcusApps.auth = firebase.auth();

  // Sign in anonymously and expose a promise that resolves with the user.
  MarcusApps.ready = MarcusApps.auth.signInAnonymously()
    .then(function () {
      return new Promise(function (resolve) {
        var unsub = MarcusApps.auth.onAuthStateChanged(function (user) {
          if (user) { unsub(); resolve(user); }
        });
      });
    })
    .catch(function (err) {
      console.warn('[MarcusApps] anon sign-in failed:', err);
      MarcusApps.offline = true;
    });
})();
