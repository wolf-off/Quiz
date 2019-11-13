import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

// // Start writing Firebase Functions
// // https://firebase.google.com/docs/functions/typescript
//
// export const helloWorld = functions.https.onRequest((request, response) => {
//  response.send("Hello from Firebase!");
// });
admin.initializeApp();

exports.getQuestions = functions.https.onCall(async (data, context) => {
    const type = data.type || "android";
    let results: any[] = [];
    await admin.database().ref('/questions/' + type).once('value').then((snapshot) => {
        const questions = snapshot.val();
        questions.forEach((question: any) => {
            results.push({ answers: question.answers, body: question.body });
        });
    });
    try {
        if (context.auth) {
            let phone = context.auth.token.phone_number;
            let uid = context.auth.token.uid;
            let name = data.name;
            if (phone && uid) {
                await admin.database().ref("/pure_results").orderByChild("phone").equalTo(phone).once("value", async snapshot => {
                    if (snapshot.hasChildren()) {
                        snapshot.forEach((itemSnapshot) => {
                            var result = itemSnapshot.val();
                            if ((type + '_request_time') in result) {
                                //be silent
                            } else {
                                result[type + '_request_time'] = Date.now();
                                itemSnapshot.ref.update(result);
                            }
                            if ((type + '_time') in result && result[type + '_time']) {
                                results = [];
                            }
                        });
                    } else {
                        var result: any = {
                            uid: uid,
                            phone: phone,
                            name: name
                        }
                        result[type + '_request_time'] = Date.now();
                        await admin.database().ref('/pure_results').push(result);
                    }
                });

            }
        }
    } catch (e) { }


    return { questions: results };
});

exports.addResult = functions.https.onCall(async (data, context) => {
    let answers: any[] = [];
    let type = 'android';
    try {
        answers = data.answers || [];
        type = data.type || 'android';
    } catch (e) { }

    let score = 0;
    let questions: any = [];
    await admin.database().ref('/questions').once('value').then((snapshot) => {
        questions = snapshot.val()[type];
    });

    for (let i = 0; i < answers.length; i++) {
        if (questions[i].right == answers[i]) {
            score++;
        }
    }

    let phone = "";
    let uid = "";
    try {
        if (context.auth) {
            phone = context.auth.token.phone_number;
            uid = context.auth.token.uid;
        }
    } catch (e) { }

    //todo check if exist

    await admin.database().ref("/pure_results").orderByChild("phone").equalTo(phone).once("value", async snapshot => {
        if (snapshot.hasChildren()) {
            snapshot.forEach((itemSnapshot) => {
                var result = itemSnapshot.val();
                if (type in result) {
                    score = -score - 1;
                } else {
                    result[type] = score;
                    result[type + '_answers'] = answers;
                    result[type + '_time'] = Date.now();
                    itemSnapshot.ref.update(result);
                }
            });
        } else {
            var result: any = {
                uid: uid,
                phone: phone,
            }
            result[type] = score;
            result[type + '_answers'] = answers;
            result[type + '_response_time'] = Date.now();
            await admin.database().ref('/pure_results').push(result);
        }
    });


    return score;
});

exports.onAdd = functions.database.ref('/pure_results').onWrite(async (snapshot, context) => {
    let ios_score = 0;
    let ios_people = 0;
    let android_score = 0;
    let android_people = 0;
    admin.database().ref('/pure_results').once("value").then((snapshot) => {
        snapshot.forEach(result => {
            if ('ios' in result.val()) {
                ios_score += result.val().ios;
                ios_people++;
            }
            if ('android' in result.val()) {
                android_score += result.val().android;
                android_people++;
            }
        });
        admin.database().ref('/results').set({
            android: {
                people: android_people,
                score: android_score
            },
            ios: {
                people: ios_people,
                score: ios_score
            }
        });
    });
});

exports.check = functions.https.onCall(async (data, context) => {
    let finishTime = "18:01";
    let acceptTime = "18:01";
    let has = false;
    if (context.auth && context.auth.token && context.auth.token.phone_number) {
        has = true;
    }
    try {
        await admin.database().ref('/finish_time').once('value').then((snapshot) => {
            finishTime = snapshot.val();
        });
        await admin.database().ref('/accept_time').once('value').then((snapshot) => {
            acceptTime = snapshot.val();
        });
    }
    catch (ex) {
        //be silent
    }

    return { has, acceptTime, finishTime };
});