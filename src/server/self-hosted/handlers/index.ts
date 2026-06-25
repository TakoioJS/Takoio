/**
 * Event dispatcher — routes incoming events to the appropriate handler
 */

import {
  handleCommentGet,
  handleCommentSubmit,
  handleCommentUpdate,
  handleCommentLike,
  handleCommentDislike,
  handleCommentDelete,
  handleCommentHide,
  handleCommentGetAdmin,
  handleCommentSetTop,
  handleCommentSetSpam,
} from './comment'
import {
  handleLogin,
  handleLogout,
  handleGetConfig,
  handleSetConfig,
  handleConfigReset,
  handlePasswordSet,
  handleCheckSetup,
  handleTypeSet,
  handleIpRegionGet,
  handlePrivateKeyGet,
  handlePrivateKeySet,
  handleSendNotification,
  handleHiddenFieldsGet,
  handleEmailTest,
} from './admin'
import {
  handleCounterGet,
  handleCounterUpdate,
  handleGetCommentsCount,
  handleGetRecentComments,
} from './counter'
import { handleImport, handleExport } from './import-export'
import {
  handleUploadImage,
} from './image'
import {
  handleReactionGet,
  handleReactionSubmit
} from './reaction'

export const dispatchEvent = async (event: string, data: any): Promise<any> => {
  switch (event) {
    case 'COMMENT_GET': return handleCommentGet(data)
    case 'COMMENT_SUBMIT': return handleCommentSubmit(data)
    case 'COMMENT_UPDATE': return handleCommentUpdate(data)
    case 'COMMENT_LIKE': return handleCommentLike(data)
    case 'COMMENT_DISLIKE': return handleCommentDislike(data)
    case 'COMMENT_DELETE': return handleCommentDelete(data)
    case 'COMMENT_HIDE': return handleCommentHide(data)
    case 'GET_CONFIG': return handleGetConfig(data)
    case 'SET_CONFIG': return handleSetConfig(data)
    case 'CONFIG_RESET': return handleConfigReset(data)
    case 'COUNTER_GET': return handleCounterGet(data)
    case 'GET_FUNC_VERSION': return { version: '3.0.0' }
    case 'GET_COMMENTS_COUNT': return handleGetCommentsCount(data)
    case 'GET_RECENT_COMMENTS': return handleGetRecentComments(data)
    case 'REACTION_GET': return handleReactionGet(data)
    case 'REACTION_SUBMIT': return handleReactionSubmit(data)
    case 'LOGIN': return handleLogin(data, data._ip)
    case 'CHECK_SETUP': return handleCheckSetup()
    case 'LOGOUT': return handleLogout(data)
    case 'UPLOAD_IMAGE': return handleUploadImage(data)
    case 'EMAIL_TEST': return handleEmailTest(data)
    case 'COMMENT_GET_ADMIN': return handleCommentGetAdmin(data)
    case 'COMMENT_IMPORT_VALINE': return handleImport('valine', data)
    case 'COMMENT_IMPORT_ARTALK': return handleImport('artalk', data)
    case 'COMMENT_IMPORT_WALINE': return handleImport('waline', data)
    case 'COMMENT_IMPORT_TWIKOO': return handleImport('twikoo', data)
    case 'COMMENT_IMPORT_DISQUS': return handleImport('disqus', data)
    case 'COMMENT_EXPORT': return handleExport(data)
    case 'COMMENT_SET_TOP': return handleCommentSetTop(data)
    case 'COMMENT_SET_SPAM': return handleCommentSetSpam(data)
    case 'COUNTER_UPDATE': return handleCounterUpdate(data)
    case 'PASSWORD_SET': return handlePasswordSet(data)
    case 'TYPE_GET': return { data: 'self-hosted' }
    case 'TYPE_SET': return handleTypeSet(data)
    case 'IP_REGION_GET': return handleIpRegionGet(data)
    case 'PRIVATE_KEY_GET': return handlePrivateKeyGet(data)
    case 'PRIVATE_KEY_SET': return handlePrivateKeySet(data)
    case 'SEND_NOTIFICATION': return handleSendNotification(data)
    case 'COMMENT_HIDDEN_FIELDS_GET': return handleHiddenFieldsGet()
    default: return { message: `未知事件: ${event}` }
  }
}
