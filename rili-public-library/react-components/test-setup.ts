import 'raf/polyfill'; // eslint-disable-line no-implicit-dependencies
import { configure } from 'enzyme'; // eslint-disable-line no-implicit-dependencies
import * as Adapter from 'enzyme-adapter-react-16'; // eslint-disable-line no-implicit-dependencies

Object.defineProperty(document, 'referrer', {
    value: 'https://www.example.com',
});
configure({ adapter: new Adapter() });
