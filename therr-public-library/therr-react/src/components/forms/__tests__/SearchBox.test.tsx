/**
 * @jest-environment jsdom
 */
import * as React from 'react';
import { mount } from 'enzyme';
import { act } from 'react-test-renderer';
import { Key as KeyCode } from 'ts-keycode-enum';
import SearchBox from '../SearchBox';

describe('SearchBox', () => {
    let wrapper: any = null;
    const mockSearch = jest.fn();
    const mockTranslate = (key: any) => key;
    const searchBoxName = 'text-search-box';
    const mockOnChange = jest.fn();

    beforeEach(() => {
        mockOnChange.mockReset();
        wrapper = mount(
            <SearchBox
                id={searchBoxName}
                labelText="Search Box"
                name={searchBoxName}
                onChange={mockOnChange}
                onSearch={mockSearch}
                translate={mockTranslate}
                value=''
            />,
        );
    });

    afterEach(() => {
        wrapper.unmount();
    });

    function simulateKeyDown(keyCode: any) {
        const element = wrapper.find('input');
        element.simulate('keyDown', { keyCode });
    }

    it('applies and removes "is-dirty" class when text is added and removed', () => {
        const expectedValue = 'Test entry';
        const inputWrapper = wrapper.find('Input');
        act(() => inputWrapper.instance().handleInputChange({
            target: {
                name: searchBoxName,
                value: expectedValue,
            },
        }));
        wrapper.setProps({
            value: expectedValue,
        });
        wrapper.update();
        expect(mockOnChange).toHaveBeenCalledTimes(1);
        expect(mockOnChange).toHaveBeenCalledWith(searchBoxName, expectedValue);
        expect(wrapper.state().inputValue).toBe(expectedValue);
        expect(wrapper.find('.search-box').hasClass('is-dirty')).toBe(true);
        act(() => inputWrapper.instance().handleInputChange({
            target: {
                name: searchBoxName,
                value: '',
            },
        }));
        wrapper.setProps({
            value: '',
        });
        wrapper.update();
        expect(wrapper.state().inputValue).toBe('');
        expect(wrapper.find('.search-box').hasClass('is-dirty')).toBe(false);
        expect(wrapper.props().onChange).toHaveBeenCalledTimes(2);
    });

    it('calls onSearch prop when enter key is pressed', () => {
        const testInput = 'Test input';
        wrapper.setProps({
            value: testInput,
        });
        wrapper.update();
        simulateKeyDown(KeyCode.Enter);
        expect(mockSearch).toHaveBeenCalledTimes(1);
        expect(mockSearch).toHaveBeenCalledWith(expect.anything(), testInput);
    });

    it('updates search text based on props', () => {
        const testInput = 'Utahraptor input';
        wrapper.setProps({
            value: testInput,
        });
        wrapper.update();

        expect(wrapper.find('Input').prop('value')).toBe(testInput);
    });
});
