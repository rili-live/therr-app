import 'raf/polyfill'; // eslint-disable-line import/extensions
import { configure } from 'enzyme';
import Adapter from '@cfaester/enzyme-adapter-react-18';

Object.defineProperty(document, 'referrer', {
    value: 'https://www.example.com',
});
configure({ adapter: new Adapter() });
