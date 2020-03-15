import { configureTranslator } from 'rili-public-library/utilities/localization'; // eslint-disable-line no-implicit-dependencies
import locales from '../locales';

const translator = configureTranslator(locales);

export default translator;