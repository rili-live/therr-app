import { configureTranslator } from 'rili-public-library/utilities/localization'; // tslint:disable-line no-implicit-dependencies
import locales from '../locales';

const translator = configureTranslator(locales);

export default translator;