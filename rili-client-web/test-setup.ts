import 'raf/polyfill'; // eslint-disable-line import/extensions
import { configure } from 'enzyme';
import * as Adapter from 'enzyme-adapter-react-16';

Object.defineProperty(document, 'referrer', {
    value: 'https://www.example.com',
});
configure({ adapter: new Adapter() });
