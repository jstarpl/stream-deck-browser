import { combineReducers, Reducer } from 'redux'
import { routerReducer as routing } from 'react-router-redux'
import { IAction, IActionWithPayload } from '../actions/helpers'
import { ISettings } from '../actions'

export interface IState {
  settings: {
    url: string
  }
}

export const settings = (state = [], action: IAction) => {
  switch (action.type) {
    case 'SET_SETTINGS':
      return [
        ...(action as IActionWithPayload<ISettings>).payload.settings
      ]
    default:
      return state
  }
}

const rootReducer = combineReducers({
  routing: routing as Reducer<any>
});


export default rootReducer;
