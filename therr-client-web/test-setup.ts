import 'raf/polyfill'; // eslint-disable-line import/extensions
import { configure } from 'enzyme';
import Adapter from '@wojtekmaj/enzyme-adapter-react-17';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

Object.defineProperty(document, 'referrer', {
    value: 'https://www.example.com',
});
configure({ adapter: new Adapter() });
