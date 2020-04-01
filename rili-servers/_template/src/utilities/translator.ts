import { configureTranslator } from 'rili-public-library/utilities/localization.js';
import locales from '../locales';

const translator = configureTranslator(locales);

export default translator;
