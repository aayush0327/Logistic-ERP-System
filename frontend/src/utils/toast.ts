import toast from 'react-hot-toast'

export const showSuccessToast = (message: string) => {
  return toast.success(message)
}

export const showErrorToast = (message: string) => {
  return toast.error(message)
}

export const showLoadingToast = (message: string) => {
  return toast.loading(message)
}

export const dismissToast = (toastId: string) => {
  toast.dismiss(toastId)
}