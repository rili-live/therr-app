import { configureTranslator } from 'rili-public-library/utilities/localization';
import locales from '../locales';

const translator = configureTranslator(locales);

export default translator;
