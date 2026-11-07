import fs from 'fs';
import path from 'path';
import { expect } from 'chai';
import { BrandVariations, PushNotifications } from 'therr-js-utilities/constants';
import { createMessage } from '../../../src/api/firebaseAdmin';
import {
    getPauseReminderStage,
    PAUSE_REMINDER_STAGES,
    selectPauseReminderCopyKeys,
} from '../../../src/api/pauseReminderCopy';

const LOCALES = ['en-us', 'es', 'fr-ca'];

const readDictionary = (locale: string): any => JSON.parse(fs.readFileSync(
    path.resolve(__dirname, `../../../src/locales/${locale}/dictionary.json`),
    'utf8',
));

const lookup = (dictionary: any, key: string): unknown => key.split('.').reduce((node, part) => node?.[part], dictionary);

describe('Habit pause reminder copy', () => {
    it('picks the stage from the reminder offset', () => {
        expect(getPauseReminderStage(7)).to.equal('week');
        expect(getPauseReminderStage(14)).to.equal('twoWeeks');
        expect(getPauseReminderStage(30)).to.equal('final');
        expect(getPauseReminderStage('14')).to.equal('twoWeeks');
    });

    it('falls back to the first stage for an offset it does not know', () => {
        [undefined, null, '', 'soon', 0, -3].forEach((value) => {
            expect(getPauseReminderStage(value), String(value)).to.equal('week');
        });
    });

    it('only mentions a saved streak when there is one', () => {
        expect(selectPauseReminderCopyKeys(7, 12).bodyKey).to.equal('notifications.habitPauseReminder.week.bodyWithStreak');
        expect(selectPauseReminderCopyKeys(7, 0).bodyKey).to.equal('notifications.habitPauseReminder.week.body');
        expect(selectPauseReminderCopyKeys(30, undefined).bodyKey).to.equal('notifications.habitPauseReminder.final.body');
    });

    it('has every selectable key in every locale', () => {
        LOCALES.forEach((locale) => {
            const dictionary = readDictionary(locale);
            PAUSE_REMINDER_STAGES.forEach((stage) => {
                ['title', 'body', 'bodyWithStreak'].forEach((leaf) => {
                    const key = `notifications.habitPauseReminder.${stage}.${leaf}`;
                    expect(lookup(dictionary, key), `${locale}: ${key}`).to.be.a('string').and.not.equal('');
                });
            });
        });
    });

    it('renders the habit name and opens the habit on Friends with Habits', () => {
        const message: any = createMessage(
            PushNotifications.Types.habitPauseReminder,
            {},
            {
                deviceToken: 'token',
                userLocale: 'en-us',
                habitName: 'Running',
                habitGoalId: 'goal-1',
                dayCount: 30,
                streakCount: 9,
            } as any,
            BrandVariations.HABITS,
        );

        expect(message.notification.title).to.have.string('Running');
        expect(message.notification.body).to.have.string('9-day');
        expect(message.notification.body).to.have.string('last time');
        expect(message.data.habitGoalId).to.equal('goal-1');
        expect(message.android.notification.clickAction)
            .to.equal(PushNotifications.AndroidIntentActions.Habits.STREAK_BROKEN);
    });
});
